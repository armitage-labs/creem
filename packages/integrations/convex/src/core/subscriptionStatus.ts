/**
 * Subscription status classification shared by the resolver, selectors, and app code.
 *
 * Creem subscription statuses fall into three groups:
 * - **active-like** — the subscription currently grants its plan's entitlements.
 *   `past_due` is included deliberately: it is a dunning grace period, not a loss
 *   of access, and the UI surfaces it through the payment-recovery banner.
 * - **terminal** — the subscription is over and will never resume on its own.
 * - **everything else** (`unpaid`, `paused`, …) — access is suspended, but the row
 *   stays open so recovery UI can act on it.
 */

const ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "scheduled_cancel",
]);

const TERMINAL_STATUSES = new Set(["canceled", "expired"]);

/**
 * Whether a subscription status grants access to the plan's entitlements.
 *
 * Use this instead of testing that a subscription merely *exists* — a returned
 * subscription may be `unpaid`, `paused`, or terminal and must not grant access.
 */
export const isActiveSubscriptionStatus = (
  status: string | null | undefined,
): boolean => (status ? ACTIVE_STATUSES.has(status) : false);

/**
 * Whether a subscription currently entitles the entity to its plan.
 *
 * Stricter than {@link isActiveSubscriptionStatus}: a `trialing` subscription
 * whose `trialEnd` has passed no longer entitles anything. The status alone is
 * not enough, because the snapshot is built from *all* subscriptions — including
 * lapsed trials — and Creem does not necessarily flip the status the instant a
 * trial runs out.
 */
export const isEntitlingSubscription = (
  subscription: { status?: string | null; trialEnd?: string | null },
  now: string,
): boolean => {
  if (!isActiveSubscriptionStatus(subscription.status)) return false;
  if (subscription.status === "trialing" && subscription.trialEnd) {
    // Compared as instants, not strings: these timestamps come from callers and
    // may use a UTC offset rather than `Z`, in which case a lexicographic
    // compare would put an already-elapsed trial in the future.
    const trialEnd = Date.parse(subscription.trialEnd);
    const reference = Date.parse(now);
    if (
      !Number.isNaN(trialEnd) &&
      !Number.isNaN(reference) &&
      trialEnd <= reference
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Whether a subscription status is terminal: the subscription has ended and
 * cannot resume. Terminal subscriptions are closed out with an `endedAt`
 * timestamp so they stop counting as the entity's current subscription.
 */
export const isTerminalSubscriptionStatus = (
  status: string | null | undefined,
): boolean => (status ? TERMINAL_STATUSES.has(status) : false);
