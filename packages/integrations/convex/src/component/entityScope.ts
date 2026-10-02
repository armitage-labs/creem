import type { MutationCtx, QueryCtx } from "./_generated/server.js";

/**
 * Billing-entity ownership of Creem customer data.
 *
 * Creem keeps one customer per store and email address. When the same person
 * checks out for two billing entities (a personal account and an
 * organization, say), both entities map to the same Creem customer, so data
 * looked up by customer alone belongs to both. Subscriptions and orders
 * therefore carry an owning `entityId`:
 *
 * - It comes from the checkout that created the row (`convexBillingEntityId`
 *   in the checkout metadata, which Creem copies onto the subscription and
 *   the order).
 * - It is write-once. Any authenticated event, even an out-of-order one, may
 *   fill a missing owner; nothing changes an existing one.
 * - Rows written before the field existed have none until
 *   `backfillBillingEntityTags` runs. Until then a row counts for the
 *   `convexBillingEntityId` its metadata records, and a row with neither
 *   counts for an entity only while no other entity has ever touched the
 *   customer.
 *
 * `customerEntityHistory` remembers every entity ever mapped to a customer,
 * because `customers` keeps only the current mapping per entity.
 */

const ENTITY_KEY = "convexBillingEntityId";

/**
 * Rows without an owner read per table and request. More are left out (and
 * stay invisible until the backfill gives them an owner), which keeps the
 * read bounded.
 */
export const LEGACY_SCAN_LIMIT = 50;

/** Customer mappings read when deciding whether a customer is shared. */
const MAPPING_SCAN_LIMIT = 50;

type Owned = { entityId?: string; metadata?: Record<string, unknown> };

/** The `convexBillingEntityId` a metadata object records, if any. */
export const ownerClaimOf = (
  metadata: Record<string, unknown> | undefined,
): string | null => {
  const entityId = metadata?.[ENTITY_KEY];
  return typeof entityId === "string" && entityId !== "" ? entityId : null;
};

/** The owner a stored row has established, from its field or its metadata. */
export const establishedOwnerOf = (row: Owned): string | null =>
  row.entityId ?? ownerClaimOf(row.metadata);

/**
 * The owner to store when writing `incoming` over `existing`: the established
 * one if there is one, otherwise the incoming claim. A conflicting claim is
 * logged and ignored.
 */
export const resolveOwner = (
  existing: Owned | null,
  incoming: Owned,
  label: string,
): string | undefined => {
  const established = existing ? establishedOwnerOf(existing) : null;
  const claimed = incoming.entityId ?? ownerClaimOf(incoming.metadata);
  if (established !== null && claimed !== null && claimed !== established) {
    console.warn(
      `[creem] ${label} stays owned by ${established}; an event claimed ${claimed}`,
    );
  }
  return established ?? claimed ?? undefined;
};

/** Remember that `entityId` was mapped to `customerId`. Idempotent. */
export const recordCustomerEntity = async (
  ctx: MutationCtx,
  customerId: string,
  entityId: string,
) => {
  const existing = await ctx.db
    .query("customerEntityHistory")
    .withIndex("customerId_entityId", (q) =>
      q.eq("customerId", customerId).eq("entityId", entityId),
    )
    .first();
  if (!existing) {
    await ctx.db.insert("customerEntityHistory", {
      customerId,
      entityId,
      recordedAt: new Date().toISOString(),
    });
  }
};

/**
 * Whether any entity other than `entityId` has touched the customer: mapped
 * to it now or before, or owning one of its subscriptions or orders. Every
 * check is an index lookup that stops at the first match, so the cost does
 * not grow with the customer's history.
 */
export const touchedByOtherEntity = async (
  ctx: QueryCtx,
  customerId: string,
  entityId: string,
): Promise<boolean> => {
  const [historyBefore, historyAfter, mappings] = await Promise.all([
    ctx.db
      .query("customerEntityHistory")
      .withIndex("customerId_entityId", (q) =>
        q.eq("customerId", customerId).lt("entityId", entityId),
      )
      .first(),
    ctx.db
      .query("customerEntityHistory")
      .withIndex("customerId_entityId", (q) =>
        q.eq("customerId", customerId).gt("entityId", entityId),
      )
      .first(),
    ctx.db
      .query("customers")
      .withIndex("id", (q) => q.eq("id", customerId))
      .take(MAPPING_SCAN_LIMIT + 1),
  ]);
  if (historyBefore || historyAfter) return true;
  if (mappings.length > MAPPING_SCAN_LIMIT) return true;
  if (mappings.some((mapping) => mapping.entityId !== entityId)) return true;

  // Owned rows of other entities. `gte("")` skips rows without an owner,
  // which sort before every string.
  const foreignRows = await Promise.all([
    ctx.db
      .query("subscriptions")
      .withIndex("customerId_entityId_endedAt", (q) =>
        q
          .eq("customerId", customerId)
          .gte("entityId", "")
          .lt("entityId", entityId),
      )
      .first(),
    ctx.db
      .query("subscriptions")
      .withIndex("customerId_entityId_endedAt", (q) =>
        q.eq("customerId", customerId).gt("entityId", entityId),
      )
      .first(),
    ctx.db
      .query("orders")
      .withIndex("customerId_entityId_type", (q) =>
        q
          .eq("customerId", customerId)
          .gte("entityId", "")
          .lt("entityId", entityId),
      )
      .first(),
    ctx.db
      .query("orders")
      .withIndex("customerId_entityId_type", (q) =>
        q.eq("customerId", customerId).gt("entityId", entityId),
      )
      .first(),
  ]);
  return foreignRows.some((row) => row !== null);
};

/**
 * Keep the rows without an owner that count for `entityId`: those whose
 * metadata records it, and untagged ones while no other entity has touched
 * the customer. The customer check runs at most once.
 */
export const legacyRowsOf = async <T extends Owned>(
  ctx: QueryCtx,
  customerId: string,
  entityId: string,
  rows: T[],
): Promise<T[]> => {
  let untaggedBelong: boolean | undefined;
  const kept: T[] = [];
  for (const row of rows.slice(0, LEGACY_SCAN_LIMIT)) {
    const claim = ownerClaimOf(row.metadata);
    if (claim !== null) {
      if (claim === entityId) kept.push(row);
      continue;
    }
    untaggedBelong ??= !(await touchedByOtherEntity(ctx, customerId, entityId));
    if (untaggedBelong) kept.push(row);
  }
  return kept;
};

/** Whether a stored subscription or order belongs to `entityId`. */
export const rowBelongsToEntity = async (
  ctx: QueryCtx,
  row: Owned & { customerId: string },
  entityId: string,
): Promise<boolean> => {
  if (row.entityId !== undefined) return row.entityId === entityId;
  const [kept] = await legacyRowsOf(ctx, row.customerId, entityId, [row]);
  return kept !== undefined;
};

export const byCreationTime = <T extends { _creationTime: number }>(
  a: T,
  b: T,
) => a._creationTime - b._creationTime;
