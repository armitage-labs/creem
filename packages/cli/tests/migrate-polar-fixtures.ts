import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

/**
 * Test doubles for `creem migrate polar`.
 *
 * `polarFetch` serves the fixtures in `fixtures/polar` as the Polar API would:
 * `recorded/` holds answers of a Polar sandbox org (org id, name and storage
 * values scrubbed, object ids kept), `hand-written/` the shapes a sandbox can't
 * produce (each file says why). It refuses every non-GET request to Polar and
 * every read of customers, subscriptions, orders, checkouts or webhooks.
 */

const FIXTURES = join(__dirname, "fixtures", "polar");
type Doc = { items: any[]; pagination?: { total_count: number; max_page: number } };
const read = (path: string): Doc => JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));

export const POLAR_ORG_ID = "00000000-0000-4000-8000-0000000000a1";
export const POLAR_TOKEN = "polar_oat_fixture_secret_token";

/** Ids of the recorded sandbox objects the tests name. */
export const ID = {
  meterApiCalls: "94c96988-2501-4c61-b338-f4fe1c3ba8f7",
  meterStorage: "eb5928df-164e-471f-9f4b-a82a22a2ce46",
  meterImages: "334f31a5-3bc5-425f-b5e0-f96274bc2c39",
  meterNested: "afb4e0e9-25f4-4f97-b044-12c367c894a6",
  productUsage: "c635a220-436e-458f-b8e1-0eb1989a16cc",
  productMeteredOnly: "53d19362-2f1e-43e3-8a1b-e0718d6c3ffd",
  productPwyw: "97519987-d58a-44db-8ab6-9ba0575ba20f",
  productPwywRecurring: "0b80c68b-40c3-4741-9b31-afd26244da8d",
  productSeats: "c0531f87-4594-444f-886a-1e6eb10f3e5b",
  productLicense: "799c693b-96d3-45b2-9f17-3854de48d073",
  productDownload: "af5d71f0-316c-46f0-9eb0-d07a33544089",
  productCredits: "6a163987-47f5-43b6-8e04-fcae6b92341e",
  productFree: "6c913505-5616-45ec-a5b6-23ce3d2682fd",
  productFreeRecurring: "28da0f12-283d-42af-b835-356784a094cb",
  productYearly: "7f034912-715e-4f0c-b2a9-2c9963ece4dc",
  productQuarterly: "1b8b5649-bf47-4a93-bb6b-ecb7bdf59e1a",
  productEur: "e6dc2557-01a6-4656-a90d-5b8f9a24929c",
  productGbp: "5409a749-9d68-4a34-981d-ab63e2fa209f",
  productArchived: "953e2973-7972-43f1-b6a3-9a94c8bcaec1",
  benefitLicense: "52401d68-513c-4ed9-afb6-b1df913efe6a",
  benefitNote: "25cb2a32-8902-4584-bf39-c19321c73ced",
  benefitCredit: "46162aff-de65-437f-95b4-ea1388324ce2",
  benefitFlag: "ee4c5d40-6e2a-4014-9178-2205f54b534b",
  benefitDownload: "8fba3e17-2dd2-4b5d-b9c3-c65e819269a2",
  // hand-written
  productLegacy: "00000000-0000-4000-8000-00000000b001",
  priceLegacyMonthly: "00000000-0000-4000-8000-00000000c001",
  priceLegacyYearly: "00000000-0000-4000-8000-00000000c002",
  productCommunity: "00000000-0000-4000-8000-00000000b002",
  productPoundOnly: "00000000-0000-4000-8000-00000000b003",
  productLegacyFree: "00000000-0000-4000-8000-00000000b004",
  benefitDiscord: "00000000-0000-4000-8000-00000000d001",
  benefitGithub: "00000000-0000-4000-8000-00000000d002",
} as const;

export function polarDocs() {
  const products = read("recorded/products.json");
  const handWritten = read("hand-written/products.json");
  return {
    organizations: read("recorded/organizations.json"),
    products: { ...products, items: [...products.items, ...handWritten.items] },
    meters: read("recorded/meters.json"),
    discounts: read("recorded/discounts.json"),
  };
}

export function polarFetch(docs = polarDocs(), options: { pageSize?: number } = {}) {
  const requests: { url: string; authorization: string | null }[] = [];
  const failing = new Set<string>();
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== "api.polar.sh" && url.hostname !== "sandbox-api.polar.sh")
      throw new Error(`UNEXPECTED_FETCH ${request.method} ${url}`);
    if (request.method !== "GET") throw new Error(`POLAR_WRITE_REFUSED ${request.method} ${url}`);
    requests.push({ url: url.toString(), authorization: request.headers.get("authorization") });
    if (/customers|subscriptions|orders|checkout|webhooks|license-keys/.test(url.pathname))
      throw new Error(`UNEXPECTED_POLAR_FETCH ${url.pathname}`);
    const path = url.pathname.replace(/\/$/, "");
    if (failing.has(path)) return Response.json({ error: "InternalServerError" }, { status: 500 });
    const doc =
      path === "/v1/organizations"
        ? docs.organizations
        : path === "/v1/products"
          ? docs.products
          : path === "/v1/meters"
            ? docs.meters
            : path === "/v1/discounts"
              ? docs.discounts
              : undefined;
    if (!doc) return Response.json({ detail: "Not found" }, { status: 404 });
    if (path !== "/v1/organizations" && url.searchParams.get("organization_id") !== POLAR_ORG_ID)
      throw new Error(`UNSCOPED_POLAR_FETCH ${url}`);
    // Pages as Polar does: `page` from 1, `limit` items, `max_page` in the pagination.
    const size = options.pageSize ?? Number(url.searchParams.get("limit") ?? 10);
    const page = Number(url.searchParams.get("page") ?? 1);
    const maxPage = Math.max(1, Math.ceil(doc.items.length / size));
    return Response.json({
      items: doc.items.slice((page - 1) * size, page * size),
      pagination: { total_count: doc.items.length, max_page: maxPage },
    });
  });
  return {
    fetcher,
    requests,
    /** Answers 500 to every read of this path (`/v1/meters`, …). */
    fail: (path: string) => failing.add(path),
  };
}
