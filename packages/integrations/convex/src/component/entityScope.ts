import type { QueryCtx } from "./_generated/server.js";

/**
 * Billing-entity scoping for Creem customer data.
 *
 * Creem keeps one customer per store and email address. When the same person
 * checks out for two billing entities (a personal account and an
 * organization, say), both entities map to the same Creem customer, so a
 * lookup by customer ID alone returns the other entity's subscriptions and
 * orders too. Every checkout records its entity as `convexBillingEntityId` in
 * the metadata Creem copies onto the subscription and the order; this module
 * filters by it.
 *
 * A row's own tag decides on its own. A row without a tag (written before the
 * key existed) belongs to the entity only while nothing on the customer points
 * at another entity: no other entity maps to the customer and no subscription
 * or order names one. Otherwise it belongs to no entity. Run
 * `backfillBillingEntityTags` once to tag such rows where the owner is
 * unambiguous.
 */

const ENTITY_KEY = "convexBillingEntityId";

/**
 * Rows read per table when collecting a customer's ownership evidence. A
 * customer with more rows than this is treated as shared, which keeps the
 * read bounded and errs on the side of isolation.
 */
export const OWNERSHIP_SCAN_LIMIT = 200;

type WithMetadata = { metadata?: Record<string, unknown> };

/** The billing entity recorded on a subscription or order, if any. */
export const billingEntityOf = (row: WithMetadata): string | null => {
  const entityId = row.metadata?.[ENTITY_KEY];
  return typeof entityId === "string" && entityId !== "" ? entityId : null;
};

/**
 * Metadata for a write over an existing row. Once a row names its entity, a
 * later webhook without the key, or with a different one, cannot move or drop
 * it; everything else comes from the incoming payload.
 */
export const preserveBillingEntity = <T extends Record<string, unknown>>(
  existing: Record<string, unknown> | undefined,
  incoming: T,
): T => {
  const established = billingEntityOf({ metadata: existing });
  if (established === null || incoming[ENTITY_KEY] === established) {
    return incoming;
  }
  if (incoming[ENTITY_KEY] !== undefined) {
    console.warn(
      `[creem] keeping billing entity ${established}; a webhook named ${String(incoming[ENTITY_KEY])}`,
    );
  }
  return { ...incoming, [ENTITY_KEY]: established };
};

/**
 * Metadata of an embedded payload with the entity of its parent filled in,
 * for payloads that omit it (an embedded subscription with `{}` metadata
 * inside a checkout that names the entity).
 */
export const withParentBillingEntity = (
  metadata: Record<string, unknown> | undefined,
  parent: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const own = metadata ?? parent ?? {};
  if (billingEntityOf({ metadata: own }) !== null) return own;
  const parentEntity = billingEntityOf({ metadata: parent });
  return parentEntity === null ? own : { ...own, [ENTITY_KEY]: parentEntity };
};

export type CustomerOwnership = {
  /** Entities mapped to the customer or named by its subscriptions and orders. */
  entities: ReadonlySet<string>;
  /** `false` when a scan hit {@link OWNERSHIP_SCAN_LIMIT}. */
  complete: boolean;
};

/** Collect, with bounded reads, which entities a Creem customer touches. */
export const loadCustomerOwnership = async (
  ctx: QueryCtx,
  customerId: string,
): Promise<CustomerOwnership> => {
  const take = OWNERSHIP_SCAN_LIMIT + 1;
  const [mappings, subscriptions, orders] = await Promise.all([
    ctx.db
      .query("customers")
      .withIndex("id", (q) => q.eq("id", customerId))
      .take(take),
    ctx.db
      .query("subscriptions")
      .withIndex("customerId", (q) => q.eq("customerId", customerId))
      .take(take),
    ctx.db
      .query("orders")
      .withIndex("customerId", (q) => q.eq("customerId", customerId))
      .take(take),
  ]);
  const entities = new Set<string>(mappings.map((row) => row.entityId));
  for (const row of [...subscriptions, ...orders]) {
    const entityId = billingEntityOf(row);
    if (entityId) entities.add(entityId);
  }
  return {
    entities,
    complete: [mappings, subscriptions, orders].every(
      (rows) => rows.length <= OWNERSHIP_SCAN_LIMIT,
    ),
  };
};

/** Whether anything on the customer points at an entity other than `entityId`. */
export const isSharedWithOthers = (
  ownership: CustomerOwnership,
  entityId: string,
): boolean => {
  if (!ownership.complete) return true;
  for (const other of ownership.entities) {
    if (other !== entityId) return true;
  }
  return false;
};

/**
 * Keep only the rows of one customer that belong to `entityId`. Tagged rows
 * decide on their own; the customer is only scanned when an untagged row
 * needs a decision, and then once for all of them.
 */
export const scopeToEntity = async <T extends WithMetadata>(
  ctx: QueryCtx,
  customerId: string,
  entityId: string,
  rows: T[],
): Promise<T[]> => {
  let untaggedBelong: boolean | undefined;
  const scoped: T[] = [];
  for (const row of rows) {
    const owner = billingEntityOf(row);
    if (owner !== null) {
      if (owner === entityId) scoped.push(row);
      continue;
    }
    untaggedBelong ??= !isSharedWithOthers(
      await loadCustomerOwnership(ctx, customerId),
      entityId,
    );
    if (untaggedBelong) scoped.push(row);
  }
  return scoped;
};
