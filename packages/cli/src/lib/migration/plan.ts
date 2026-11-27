import type { CreateFileUploadRequestEntity } from "creem/models/components";
import type {
  CreateDiscountRequest,
  CreateProductGroupRequest,
  CreateProductRequest,
  UpdateDiscountRequest,
  UpdateProductRequest,
} from "creem/models/operations";
import type { AdoptionProposal, MigrationIssue, MigrationItem, MigrationReport } from "./report";

/**
 * One write of a migration, typed from the generated SDK. The writer sends
 * them in order. A file feature that waits for an upload in the same run
 * names its file `upload:<file key>`; the writer swaps in the uploaded id.
 *
 * Products, product groups and discounts are written with the keyed upserts
 * (`upsert_*`, a `POST` with `external_id`), which create the object when the
 * key is new and change only the fields sent otherwise, so two runs can't
 * create it twice. Two writes are addressed by id instead: adopting an object
 * without a key (`adopt_*`, a `PATCH` that gives it its key and makes the
 * item's changes in the same request), and an update that clears a field
 * (`update_*`: a trial, a redemption limit or an expiry date), because the
 * upsert's body takes no `null`.
 */
export type MigrationRequest =
  | { type: "adopt_product"; key: string; request: UpdateProductRequest }
  | { type: "adopt_discount"; key: string; request: UpdateDiscountRequest }
  | {
      type: "upload_file";
      key: string;
      lsFileId: string;
      request: CreateFileUploadRequestEntity;
    }
  | { type: "upsert_product"; key: string; request: CreateProductRequest }
  | { type: "update_product"; key: string; request: UpdateProductRequest }
  | { type: "upsert_product_group"; key: string; request: CreateProductGroupRequest }
  | { type: "upsert_discount"; key: string; request: CreateDiscountRequest }
  | { type: "update_discount"; key: string; request: UpdateDiscountRequest };

export interface MigrationPlan {
  requests: MigrationRequest[];
  report: MigrationReport;
  /**
   * Adoption answers that answer nothing or can't be applied (`adoption_answer_invalid`).
   * The plan must not run while there are any: the command stops with exit 2.
   */
  answerErrors: MigrationIssue[];
  /**
   * The stored product group each Creem product is in, by product id, from the
   * catalog the plan was made from. Creem's `product_already_grouped` names the
   * products only (`details.product_ids`); the error's hint names their group.
   */
  productGroupOf: Record<string, { id: string; externalId: string | null }>;
}

export const UPLOAD_PREFIX = "upload:";
/** The answer to an adoption proposal that creates a new object instead. */
export const ADOPT_NEW = "new";

export const issue = (code: string, message: string): MigrationIssue => ({ code, message });

/** An update body that sets a field to `null`, which only a `PATCH` can send. */
export function clearsField(body: Record<string, unknown>): boolean {
  return Object.values(body).some((value) => value === null);
}

/** Names match ignoring case and spacing (ADR § 2.10 candidate rule). */
export function sameName(a: string | null | undefined, b: string): boolean {
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(a ?? "") === normalize(b);
}

/**
 * The adoption proposals of one plan (ADR § 2.6), shared by every migrator.
 * `answers` are by proposal id (`adopt:<key>`): the Creem id of the candidate
 * to adopt, or `new` to create a new object.
 */
export function adoptionMatcher(answers: Record<string, string>) {
  /** Candidates an earlier item adopted, with the key they got. */
  const claimed = new Map<string, string>();
  /** Answers some item looked at; the others answer nothing. */
  const consulted = new Set<string>();
  const answerErrors: MigrationIssue[] = [];
  const proposals: AdoptionProposal[] = [];
  const rejectAnswer = (key: string, message: string) => {
    const error = issue(
      "adoption_answer_invalid",
      `--adopt ${key}=${answers[`adopt:${key}`]}: ${message}`,
    );
    answerErrors.push(error);
    return error;
  };

  /**
   * Finds the Creem object a key matches. Without one, the look-alikes without
   * a key become one proposal (ADR § 2.6): adopted only when the answer names
   * one of them (or another unkeyed object of the kind), a new object when it
   * is `new`, and pending otherwise. An answer that can't be applied rejects
   * the item.
   */
  function match<T extends { id: string; externalId: string | null; name?: string }>(
    kind: "product" | "discount",
    key: string,
    byKey: Map<string, T>,
    all: T[],
    lookalikes: T[],
    differences: (candidate: T) => string[],
    item: MigrationItem,
  ): { existing?: T; pending?: T[]; rejected?: MigrationIssue } {
    const id = `adopt:${key}`;
    const answer = answers[id];
    if (answer !== undefined) consulted.add(id);
    const existing = byKey.get(key);
    if (existing) {
      // The same answers re-run cleanly: the adopted or created object has the key now.
      if (answer !== undefined && answer !== ADOPT_NEW && answer !== existing.id)
        return {
          rejected: rejectAnswer(
            key,
            `Creem ${kind} ${existing.id} already has the key ${key}, so ${answer} can't get it.`,
          ),
        };
      return { existing };
    }
    const open = lookalikes.filter((c) => !c.externalId && !claimed.has(c.id));
    let chosen: T | undefined;
    if (answer !== undefined && answer !== ADOPT_NEW) {
      chosen = open.find((c) => c.id === answer);
      if (!chosen) {
        const named = all.find((c) => c.id === answer);
        const problem = !named
          ? `there is no Creem ${kind} ${answer}.`
          : named.externalId
            ? `Creem ${kind} ${answer} already has the key ${named.externalId}.`
            : claimed.has(answer)
              ? `Creem ${kind} ${answer} is already adopted as ${claimed.get(answer)}; two keys can't adopt one ${kind}.`
              : undefined;
        if (problem) return { rejected: rejectAnswer(key, problem) };
        // An unkeyed object the merchant named that isn't a look-alike (renamed).
        chosen = named;
      }
    }
    if (!open.length && !chosen) return {};
    const candidates = chosen && !open.includes(chosen) ? [chosen, ...open] : open;
    const proposal: AdoptionProposal = {
      id,
      kind,
      key,
      name: item.name,
      candidates: candidates.map((c) => ({
        creem_id: c.id,
        creem_name: c.name ?? "",
        differences: differences(c),
      })),
      decision: "pending",
      creem_id: null,
    };
    proposals.push(proposal);
    if (answer === ADOPT_NEW) {
      proposal.decision = "declined";
      return {};
    }
    if (!chosen) return { pending: open };
    claimed.set(chosen.id, key);
    proposal.decision = "accepted";
    proposal.creem_id = chosen.id;
    item.adopted_from = chosen.id;
    item.changes.push("external_id");
    return { existing: chosen };
  }

  /** The skip reason of an item whose proposal waits for an answer. */
  function unconfirmed(kind: "product" | "discount", key: string, pending: { id: string }[]) {
    const ids = pending.map((c) => c.id);
    const what =
      ids.length === 1
        ? `Creem ${kind} ${ids[0]} has no key and looks like this one.`
        : `${ids.length} Creem ${kind}s without a key look like this one (${ids.join(", ")}).`;
    return issue(
      "adoption_unconfirmed",
      `${what} Answer the proposal: adopt one (in a terminal, or with --adopt ${key}=<creem id>) or create a new ${kind} (--adopt ${key}=new).`,
    );
  }

  /** Rejects the answers no item looked at; call once every item is matched. */
  function finish() {
    for (const id of Object.keys(answers))
      if (!consulted.has(id))
        rejectAnswer(
          id.slice("adopt:".length),
          "the run migrates nothing with this key (a typo, or an item skipped by a mapping rule: see its reason in the plan).",
        );
  }

  return { match, unconfirmed, finish, proposals, answerErrors };
}
