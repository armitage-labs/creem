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
 * Rows written before that key existed carry no entity. Such a row belongs to
 * an entity only while no subscription or order of the same customer names a
 * different entity, because a customer that is demonstrably shared gives no
 * way to tell whose the unlabelled row is.
 */

type WithMetadata = { metadata?: Record<string, unknown> };

/** The billing entity recorded on a subscription or order, if any. */
export const billingEntityOf = (row: WithMetadata): string | null => {
  const entityId = row.metadata?.convexBillingEntityId;
  return typeof entityId === "string" && entityId !== "" ? entityId : null;
};

/** Entities named by any subscription or order of a Creem customer. */
export const namedBillingEntities = async (
  ctx: QueryCtx,
  customerId: string,
): Promise<Set<string>> => {
  const [subscriptions, orders] = await Promise.all([
    ctx.db
      .query("subscriptions")
      .withIndex("customerId", (q) => q.eq("customerId", customerId))
      .collect(),
    ctx.db
      .query("orders")
      .withIndex("customerId", (q) => q.eq("customerId", customerId))
      .collect(),
  ]);
  const named = new Set<string>();
  for (const row of [...subscriptions, ...orders]) {
    const entityId = billingEntityOf(row);
    if (entityId) named.add(entityId);
  }
  return named;
};

/** Whether a row of the customer belongs to `entityId` under the rule above. */
export const belongsToEntity = (
  row: WithMetadata,
  entityId: string,
  named: ReadonlySet<string>,
): boolean => {
  const owner = billingEntityOf(row);
  if (owner !== null) return owner === entityId;
  for (const other of named) {
    if (other !== entityId) return false;
  }
  return true;
};

/** Keep only the rows of one customer that belong to `entityId`. */
export const scopeToEntity = async <T extends WithMetadata>(
  ctx: QueryCtx,
  customerId: string,
  entityId: string,
  rows: T[],
): Promise<T[]> => {
  const named = await namedBillingEntities(ctx, customerId);
  return rows.filter((row) => belongsToEntity(row, entityId, named));
};
