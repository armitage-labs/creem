import type { Creem } from "creem";
import type * as components from "creem/models/components";
import { CliError } from "../errors";

/**
 * Pairing a test and a live item by key (ENG-2437, ADR catalog-as-code § 2.6,
 * § 2.10): the same `external_id` on both sides is a pair. There is no pairing
 * endpoint; these are the products' and meters' own `PATCH`es, through the
 * test key on test and the live key on live.
 */

export type PairKind = "product" | "meter";
export type Side = "test" | "live";
export interface Clients {
  test: Creem;
  live: Creem;
}

/** One side's write of a pairing. */
export interface SideWrite {
  id: string;
  /** `created`, `updated` or `unchanged`, as the write answered it. */
  result: string;
}
export interface LinkReport {
  kind: PairKind | "feature";
  key: string;
  /** `null`: there is no live item, so only test was written. */
  live: SideWrite | null;
  test: SideWrite;
}

/** Live was written, then test's write failed: the pair is half done. */
export class LinkPartialError extends CliError {
  constructor(
    readonly report: Omit<LinkReport, "test"> & { test: { id: string; result: "failed" } },
    readonly testError: unknown,
    testLabel: string,
  ) {
    super(
      `Live written: LIVE ${report.live?.id} has the key ${report.key}. ${testLabel} was not written: ${describeCause(testError)}.`,
      4,
      "Run the same creem catalog link again to finish the pair: its live write is then unchanged. The next promote dry run proposes the live key for the test item too.",
    );
    this.name = "LinkPartialError";
  }
}

function describeCause(cause: unknown): string {
  if (typeof cause === "object" && cause !== null) {
    const body = (cause as { body?: unknown }).body;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { code?: unknown; message?: unknown };
        if (typeof parsed.message === "string")
          return typeof parsed.code === "string"
            ? `${parsed.code}: ${parsed.message}`
            : parsed.message;
      } catch {
        // not JSON: fall through to the error's message
      }
    }
  }
  return cause instanceof Error ? cause.message : String(cause);
}

/** Creem answered a pairing write's dry run as a real write (Q59). */
function assertDryRun(side: Side, id: string, writeResult: { dryRun: boolean }): void {
  if (writeResult.dryRun !== true)
    throw new CliError(
      `Creem answered the dry run of ${side.toUpperCase()} ${id} with write_result.dry_run ${JSON.stringify(writeResult.dryRun)} instead of true, so it may have written the key. Nothing else was sent.`,
      1,
      "Check both items in the dashboard before running the command again.",
    );
}

export async function readItem(
  client: Creem,
  kind: PairKind,
  id: string,
): Promise<{ id: string; name: string; externalId: string | null }> {
  return kind === "product" ? client.products.get({ id }) : client.meters.getMeter({ id });
}

/** `PATCH` of one item's key, or its dry run. */
async function writeKey(
  client: Creem,
  kind: PairKind,
  id: string,
  externalId: string | null,
  dryRun: boolean,
): Promise<{ writeResult: { result: string; dryRun: boolean } }> {
  return kind === "product"
    ? client.products.update({ id, dryRun, updateProductRequestEntity: { externalId } })
    : client.meters.updateMeter({ id, dryRun, updateMeterApiRequestDto: { externalId } });
}

/** The key `link` proposes for an item pair: the live item's key, else the test item's id. */
export const proposeItemKey = (live: { externalId: string | null } | null, testId: string) =>
  live?.externalId ?? testId;

/**
 * The two writes of a pair, in a fixed order (ADR § 2.10): first each side's
 * dry run, so a key either side already holds (`409` `external_id_taken`)
 * stops it before anything is written; then live, then test. A failed test
 * write is a {@link LinkPartialError}: the next `link`, or the next promote
 * dry run, finishes the pair.
 */
async function pairWrites(
  key: string,
  kind: LinkReport["kind"],
  live: {
    id: string;
    write: (dryRun: boolean) => Promise<{ writeResult: { result: string; dryRun: boolean } }>;
  } | null,
  test: {
    id: string;
    label: string;
    write: (dryRun: boolean) => Promise<{ writeResult: { result: string; dryRun: boolean } }>;
  },
): Promise<LinkReport> {
  if (live) assertDryRun("live", live.id, (await live.write(true)).writeResult);
  assertDryRun("test", test.id, (await test.write(true)).writeResult);
  const liveWrite = live
    ? { id: live.id, result: (await live.write(false)).writeResult.result }
    : null;
  try {
    const testWrite = { id: test.id, result: (await test.write(false)).writeResult.result };
    return { kind, key, live: liveWrite, test: testWrite };
  } catch (cause) {
    if (!liveWrite) throw cause;
    throw new LinkPartialError(
      { kind, key, live: liveWrite, test: { id: test.id, result: "failed" } },
      cause,
      test.label,
    );
  }
}

/** Writes `key` on the test item and, when given, on the live item (live first). */
export function linkItem(
  clients: Clients,
  input: { kind: PairKind; testId: string; liveId?: string | undefined; key: string },
): Promise<LinkReport> {
  const { kind, testId, liveId, key } = input;
  return pairWrites(
    key,
    kind,
    liveId === undefined
      ? null
      : { id: liveId, write: (dryRun) => writeKey(clients.live, kind, liveId, key, dryRun) },
    {
      id: testId,
      label: `TEST ${testId}`,
      write: (dryRun) => writeKey(clients.test, kind, testId, key, dryRun),
    },
  );
}

/** Clears the live item's key, which breaks its pair (renaming the key renames the identity, § 2.6). */
export async function unlinkItem(live: Creem, kind: PairKind, liveId: string): Promise<SideWrite> {
  const answer = await writeKey(live, kind, liveId, null, false);
  return { id: liveId, result: answer.writeResult.result };
}

type Feature = components.FeatureEntity;
type FeatureEntry = components.UpdateProductRequestEntityFeatures;

/** A stored feature as an edit entry of its product's write, with `externalId` set. */
function featureEntry(feature: Feature, externalId: string | null): FeatureEntry {
  const base = { id: feature.id, externalId, description: feature.description };
  switch (feature.type) {
    case "customerCredits":
      if (!feature.customerCredits) break;
      return { ...base, type: "customerCredits", customerCredits: feature.customerCredits };
    case "licenseKey":
      if (!feature.licenseKey) break;
      return { ...base, type: "licenseKey", licenseKey: feature.licenseKey };
    case "custom":
      return { ...base, type: "custom", privateNote: feature.privateNote ?? "" };
  }
  throw new CliError(
    `Feature ${feature.id} is a ${String(feature.type)} feature, which promote doesn't pair.`,
    2,
    "Link customer credit, license key or private note features.",
  );
}

/**
 * The product write that gives one feature its key: the product's complete set
 * of that feature's type, each feature as it is, with the key on this one,
 * because a feature left out of its type's set is removed (ADR § 2.9).
 */
function featureWrite(
  client: Creem,
  product: components.ProductEntity,
  featureId: string,
  key: string,
) {
  const target = (product.features ?? []).find((f) => f.id === featureId);
  if (!target)
    throw new CliError(
      `Product ${product.id} has no feature ${featureId}.`,
      2,
      "Check the feature id with creem products get.",
    );
  const features = (product.features ?? [])
    .filter((f) => f.type === target.type)
    .map((f) => featureEntry(f, f.id === featureId ? key : f.externalId));
  return {
    target,
    write: (dryRun: boolean) =>
      client.products.update({
        id: product.id,
        dryRun,
        updateProductRequestEntity: { features },
      }),
  };
}

/** The live product paired with a test product: the one with its key. */
export async function pairedLiveProduct(
  clients: Clients,
  testProduct: components.ProductEntity,
): Promise<components.ProductEntity> {
  const key = testProduct.externalId;
  if (!key)
    throw new CliError(
      `Test product ${testProduct.id} has no key, so it has no live pair yet.`,
      2,
      "Pair the products first (link the product first: creem catalog link --kind product), then link its features.",
    );
  const page = await clients.live.products.search({ externalId: key });
  const live = page.result.items.find((p) => p.externalId === key);
  if (!live)
    throw new CliError(
      `No live product has the key ${key}.`,
      2,
      "Promote the product first, or link it to its live product with creem catalog link --kind product.",
    );
  return live;
}

/**
 * The key `link --kind feature` proposes: the test feature's own key (a key
 * renamed in test goes onto the live feature, never the old live key back onto
 * test), else the live feature's, else the test feature's id.
 */
export const proposeFeatureKey = (test: Feature, live: Feature | undefined) =>
  test.externalId ?? live?.externalId ?? test.id;

export type FeatureLink = {
  testProduct: components.ProductEntity;
  testFeature: Feature;
} & (
  | { liveProduct: components.ProductEntity; liveFeature: Feature }
  /** A test-only key: no live feature, so no live product is read or needed. */
  | { liveProduct?: undefined; liveFeature?: undefined }
);

/**
 * Reads the test product and feature of a feature link and, when it links to a
 * live feature, the paired live product and that feature.
 */
export async function readFeatureLink(
  clients: Clients,
  input: { testProductId: string; testFeatureId: string; liveFeatureId?: string | undefined },
): Promise<FeatureLink> {
  const testProduct = await clients.test.products.get({ id: input.testProductId });
  const testFeature = (testProduct.features ?? []).find((f) => f.id === input.testFeatureId);
  if (!testFeature)
    throw new CliError(
      `Test product ${testProduct.id} has no feature ${input.testFeatureId}.`,
      2,
      "Check the feature id with creem products get.",
    );
  if (input.liveFeatureId === undefined) return { testProduct, testFeature };
  const liveProduct = await pairedLiveProduct(clients, testProduct);
  const liveFeature = (liveProduct.features ?? []).find((f) => f.id === input.liveFeatureId);
  if (!liveFeature)
    throw new CliError(
      `Live product ${liveProduct.id} has no feature ${input.liveFeatureId}.`,
      2,
      "Check the feature id with creem products get --environment live.",
    );
  if (liveFeature.type !== testFeature.type)
    throw new CliError(
      `Feature ${testFeature.id} is ${testFeature.type}, ${liveFeature.id} is ${liveFeature.type}.`,
      2,
      "Pair features of the same type.",
    );
  return { testProduct, liveProduct, testFeature, liveFeature };
}

/**
 * Gives a test feature and its live feature the same key through each side's
 * product write, live first. With no live feature it is one write, on test.
 */
export function linkFeature(clients: Clients, link: FeatureLink, key: string): Promise<LinkReport> {
  const test = featureWrite(clients.test, link.testProduct, link.testFeature.id, key);
  const live = link.liveFeature
    ? {
        id: link.liveFeature.id,
        write: featureWrite(clients.live, link.liveProduct, link.liveFeature.id, key).write,
      }
    : null;
  return pairWrites(key, "feature", live, {
    id: link.testFeature.id,
    label: `TEST ${link.testFeature.id} (product ${link.testProduct.id})`,
    write: test.write,
  });
}

/**
 * Q102: copies the live product's `metadata` keys that the test product lacks
 * into the test product (promote has no write path into test). Answers the
 * keys it copied.
 */
export async function copyLiveMetadata(
  clients: Clients,
  testId: string,
  liveId: string,
): Promise<string[]> {
  const [test, live] = await Promise.all([
    clients.test.products.get({ id: testId }),
    clients.live.products.get({ id: liveId }),
  ]);
  const testMetadata: Record<string, unknown> = { ...(test.metadata ?? {}) };
  const copied = Object.keys(live.metadata ?? {}).filter(
    (key) => !Object.hasOwn(testMetadata, key),
  );
  if (!copied.length) return [];
  for (const key of copied) testMetadata[key] = (live.metadata ?? {})[key];
  const write = (dryRun: boolean) =>
    clients.test.products.update({
      id: testId,
      dryRun,
      updateProductRequestEntity: { metadata: testMetadata },
    });
  assertDryRun("test", testId, (await write(true)).writeResult);
  await write(false);
  return copied;
}
