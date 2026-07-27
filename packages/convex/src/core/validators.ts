import { v, type Infer, type ObjectType } from "convex/values";
import schema from "../component/schema.js";

/**
 * Convex validators for every value the connected widgets read.
 *
 * These are the single source of truth: the matching TypeScript types in
 * `types.ts` and `model.ts` are derived from them with `Infer<>`, and the
 * generated `creem.api({ resolve })` functions use them as `returns`
 * validators. That gives Convex clients real end-to-end types instead of
 * `any`, and makes a shape drift a build error rather than a runtime surprise.
 *
 * Import this module from server code only — it pulls in `convex/values` at
 * runtime. UI code should import the derived types from `types.js`/`model.js`,
 * which erase at build time.
 */

export const recurringCycleValidator = v.union(
  v.literal("every-month"),
  v.literal("every-three-months"),
  v.literal("every-six-months"),
  v.literal("every-year"),
  v.literal("custom"),
);

export const paymentRecoveryStateValidator = v.union(
  v.literal("none"),
  v.literal("warning"),
  v.literal("blocked"),
);

export const availableActionValidator = v.union(
  v.literal("checkout"),
  v.literal("portal"),
  v.literal("cancel"),
  v.literal("reactivate"),
  v.literal("switch_interval"),
  v.literal("update_units"),
  v.literal("contact_sales"),
);

const nullableString = v.union(v.string(), v.null());

// ── Billing snapshot ──────────────────────────────────────────────────

export const billingSnapshotSubscriptionValidator = v.object({
  planId: nullableString,
  productId: v.string(),
  subscriptionId: v.string(),
  status: v.string(),
  recurringCycle: v.union(recurringCycleValidator, v.null()),
  kind: v.optional(v.string()),
  units: v.optional(v.union(v.number(), v.null())),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  currentPeriodEnd: v.optional(nullableString),
  trialEnd: v.optional(nullableString),
});

export const billingSnapshotOrderValidator = v.object({
  planId: nullableString,
  orderId: v.string(),
  productId: v.string(),
  status: v.string(),
});

export const appPlanAssignmentValidator =
  schema.tables.appPlanAssignments.validator;

export const appPlanActivationValidator =
  schema.tables.appPlanActivations.validator;

/**
 * Wire shape of a scheduled update as it crosses the component boundary.
 *
 * Mirrors the component table, except `scheduledFunctionId` is a plain string:
 * the `Id<"_scheduled_functions">` brand belongs to the component's own data
 * model and does not survive the boundary.
 */
export const scheduledSubscriptionUpdateValidator = v.object({
  ...schema.tables.scheduledSubscriptionUpdates.validator.fields,
  scheduledFunctionId: v.optional(v.string()),
});

export const billingAccessItemValidator = v.union(
  v.object({
    source: v.literal("creem_subscription"),
    kind: v.literal("subscription"),
    planId: nullableString,
    productId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    recurringCycle: v.union(recurringCycleValidator, v.null()),
    units: v.optional(v.union(v.number(), v.null())),
    currentPeriodEnd: v.optional(nullableString),
    trialEnd: v.optional(nullableString),
  }),
  v.object({
    source: v.literal("creem_order"),
    kind: v.literal("one_time"),
    planId: nullableString,
    productId: v.string(),
    orderId: v.string(),
    status: v.string(),
  }),
  v.object({
    source: v.literal("app_plan_assignment"),
    kind: v.literal("app_plan"),
    planId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("scheduled"),
      v.literal("ended"),
    ),
    startsAt: v.string(),
    endsAt: v.optional(nullableString),
    assignmentSource: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  }),
);

export const billingSnapshotValidator = v.object({
  entityId: v.string(),
  catalogVersion: v.optional(v.string()),
  subscriptions: v.array(billingSnapshotSubscriptionValidator),
  orders: v.array(billingSnapshotOrderValidator),
  appPlanAssignments: v.array(appPlanAssignmentValidator),
  access: v.array(billingAccessItemValidator),
  paymentRecoveryState: paymentRecoveryStateValidator,
  availableBillingActions: v.array(availableActionValidator),
  resolvedAt: v.string(),
});

// ── Connected billing model ───────────────────────────────────────────

/** Synced Creem product, exactly as stored in the component's `products` table. */
export const connectedProductValidator = schema.tables.products.validator;

export const connectedActiveSubscriptionValidator = v.object({
  id: v.string(),
  productId: v.string(),
  status: v.string(),
  cancelAtPeriodEnd: v.boolean(),
  currentPeriodEnd: nullableString,
  currentPeriodStart: v.string(),
  units: v.union(v.number(), v.null()),
  recurringInterval: nullableString,
  trialEnd: v.optional(nullableString),
});

export const connectedBillingUserValidator = v.object({
  /** Host-app user ID. Generic across integrations — not a Convex document ID. */
  id: v.string(),
  email: v.string(),
});

/**
 * `catalog` is app-authored data round-tripping through the query, so it is
 * intentionally unvalidated. The `PlanCatalog` TypeScript type is the contract;
 * a strict validator here would reject catalogs carrying app-specific metadata.
 */
export const connectedBillingModelValidator = v.object({
  user: v.union(connectedBillingUserValidator, v.null()),
  catalog: v.optional(v.any()),
  snapshot: v.union(billingSnapshotValidator, v.null()),
  allProducts: v.array(connectedProductValidator),
  ownedProductIds: v.array(v.string()),
  subscriptionProductId: nullableString,
  activePlanId: v.optional(nullableString),
  activeFreePlanId: v.optional(nullableString),
  appPlanActivations: v.array(appPlanActivationValidator),
  appPlanAssignments: v.array(appPlanAssignmentValidator),
  activeSubscriptions: v.array(connectedActiveSubscriptionValidator),
  scheduledSubscriptionUpdates: v.array(scheduledSubscriptionUpdateValidator),
  hasCreemCustomer: v.boolean(),
});

// ── Transactions ──────────────────────────────────────────────────────

export const connectedTransactionValidator = v.object({
  id: v.string(),
  amount: v.number(),
  amountPaid: v.optional(v.union(v.number(), v.null())),
  discountAmount: v.optional(v.union(v.number(), v.null())),
  currency: v.string(),
  type: v.string(),
  taxCountry: v.optional(nullableString),
  taxAmount: v.optional(v.union(v.number(), v.null())),
  status: v.string(),
  refundedAmount: v.optional(v.union(v.number(), v.null())),
  order: v.optional(nullableString),
  subscription: v.optional(nullableString),
  customer: v.optional(nullableString),
  description: v.optional(v.string()),
  periodStart: v.optional(v.number()),
  periodEnd: v.optional(v.number()),
  createdAt: v.number(),
});

export const connectedPaginationValidator = v.object({
  totalRecords: v.number(),
  totalPages: v.number(),
  currentPage: v.number(),
  nextPage: v.union(v.number(), v.null()),
  prevPage: v.union(v.number(), v.null()),
});

export const connectedTransactionListValidator = v.object({
  items: v.array(connectedTransactionValidator),
  pagination: connectedPaginationValidator,
});

// ── Customer credits ──────────────────────────────────────────────────

export const creditBalanceValidator = v.object({
  /** Balance as a string to preserve big integer precision. */
  balance: v.string(),
  updatedAt: v.optional(v.string()),
  asOf: v.optional(v.string()),
});

export const creditEntryValidator = v.object({
  id: v.string(),
  transactionId: v.string(),
  accountId: v.string(),
  side: v.union(v.literal("debit"), v.literal("credit")),
  amount: v.string(),
  createdAt: v.string(),
});

export const creditEntryListValidator = v.object({
  entries: v.array(creditEntryValidator),
  hasMore: v.boolean(),
});

// ── Shared arg validators ─────────────────────────────────────────────
// Use these when writing your own Convex functions that wrap creem methods
// (e.g. for RBAC). They match exactly what the connected widgets send.

/**
 * Convex arg validator for checkout creation.
 * Matches the args sent by `<Subscription.Root>` and `<Product.Root>` widgets.
 * Use in your own `action()` definitions for custom RBAC wrappers.
 */
export const checkoutCreateArgs = {
  productId: v.string(),
  successUrl: v.optional(v.string()),
  fallbackSuccessUrl: v.optional(v.string()),
  units: v.optional(v.number()),
  metadata: v.optional(v.record(v.string(), v.string())),
  discountCode: v.optional(v.string()),
  theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
};

/** Creem proration behaviors for paid-to-paid switches and unit changes. */
export const paidSubscriptionUpdateBehaviorValidator = v.union(
  v.literal("proration-charge-immediately"),
  v.literal("proration-charge"),
  v.literal("proration-none"),
  v.literal("period-end"),
);

/** Cancellation behaviors for paid-to-free / paid-to-app-owned switches. */
export const freePlanUpdateBehaviorValidator = v.union(
  v.literal("period-end"),
  v.literal("immediate"),
);

/** Discriminator for the three mutually exclusive subscription update targets. */
export const subscriptionUpdateKindValidator = v.union(
  v.literal("plan"),
  v.literal("units"),
  v.literal("app-plan"),
);

/**
 * Convex arg validator for subscription updates.
 *
 * Convex requires top-level args to be a flat object, so the wire validator is
 * permissive and `kind` is the discriminator. The exported
 * {@link SubscriptionUpdateArgs} type is a real discriminated union — that is
 * what `creem.subscriptions.update` and the widgets are typed against, so
 * invalid combinations do not compile. The handler re-checks them at runtime
 * for callers that arrive over the wire.
 */
export const subscriptionUpdateArgs = {
  /**
   * - `"plan"` — switch to another paid Creem product (`productId` required)
   * - `"units"` — change the quantity on the current paid subscription (`units` required)
   * - `"app-plan"` — move to an app-owned plan (`freePlanId` required)
   */
  kind: subscriptionUpdateKindValidator,
  subscriptionId: v.optional(v.string()),
  productId: v.optional(v.string()),
  freePlanId: v.optional(v.string()),
  units: v.optional(v.number()),
  updateBehavior: v.optional(
    v.union(
      paidSubscriptionUpdateBehaviorValidator,
      freePlanUpdateBehaviorValidator,
    ),
  ),
};

/**
 * Subscription update arguments as a discriminated union.
 *
 * `"immediate"` is only reachable from `"app-plan"`, because a Creem
 * paid-to-paid switch cannot cancel immediately, and each variant carries
 * exactly one target.
 */
export type SubscriptionUpdateArgs =
  | {
      kind: "plan";
      subscriptionId?: string;
      /**
       * Target Creem product. A plan switch keeps the current quantity — send a
       * separate `kind: "units"` update to change it, because Creem applies a
       * product upgrade and a quantity change as distinct operations.
       */
      productId: string;
      updateBehavior?: Infer<typeof paidSubscriptionUpdateBehaviorValidator>;
    }
  | {
      kind: "units";
      subscriptionId?: string;
      /** New quantity for the active unit-based subscription. */
      units: number;
      updateBehavior?: Infer<typeof paidSubscriptionUpdateBehaviorValidator>;
    }
  | {
      kind: "app-plan";
      subscriptionId?: string;
      /** Target app-owned catalog plan (free, trial, or custom). */
      freePlanId: string;
      updateBehavior?: Infer<typeof freePlanUpdateBehaviorValidator>;
    };

/** Permissive wire shape accepted by the generated `subscriptions.update` mutation. */
export type SubscriptionUpdateWireArgs = ObjectType<
  typeof subscriptionUpdateArgs
>;

/**
 * Narrow permissive wire args into the discriminated union.
 *
 * Rejects a variant that is missing its target or carries a behavior the
 * variant does not support — the guarantees the validator itself cannot
 * express.
 */
export const parseSubscriptionUpdateArgs = (
  args: SubscriptionUpdateWireArgs,
): SubscriptionUpdateArgs => {
  const paidBehaviors = new Set([
    "proration-charge-immediately",
    "proration-charge",
    "proration-none",
    "period-end",
  ]);

  switch (args.kind) {
    case "plan": {
      if (!args.productId) {
        throw new Error('kind: "plan" requires productId');
      }
      if (args.freePlanId) {
        throw new Error('kind: "plan" cannot also set freePlanId');
      }
      if (args.units !== undefined) {
        throw new Error(
          'kind: "plan" cannot also set units — send a separate kind: "units" update',
        );
      }
      if (args.updateBehavior && !paidBehaviors.has(args.updateBehavior)) {
        throw new Error(
          `updateBehavior: "${args.updateBehavior}" is not valid for a paid plan switch`,
        );
      }
      return {
        kind: "plan",
        productId: args.productId,
        ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
        ...(args.updateBehavior
          ? {
              updateBehavior: args.updateBehavior as Infer<
                typeof paidSubscriptionUpdateBehaviorValidator
              >,
            }
          : {}),
      };
    }
    case "units": {
      if (args.units === undefined) {
        throw new Error('kind: "units" requires units');
      }
      if (args.productId || args.freePlanId) {
        throw new Error(
          'kind: "units" cannot also set productId or freePlanId',
        );
      }
      if (args.updateBehavior && !paidBehaviors.has(args.updateBehavior)) {
        throw new Error(
          `updateBehavior: "${args.updateBehavior}" is not valid for a unit update`,
        );
      }
      return {
        kind: "units",
        units: args.units,
        ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
        ...(args.updateBehavior
          ? {
              updateBehavior: args.updateBehavior as Infer<
                typeof paidSubscriptionUpdateBehaviorValidator
              >,
            }
          : {}),
      };
    }
    case "app-plan": {
      if (!args.freePlanId) {
        throw new Error('kind: "app-plan" requires freePlanId');
      }
      if (args.productId || args.units !== undefined) {
        throw new Error('kind: "app-plan" cannot also set productId or units');
      }
      if (
        args.updateBehavior &&
        args.updateBehavior !== "period-end" &&
        args.updateBehavior !== "immediate"
      ) {
        throw new Error(
          `updateBehavior: "${args.updateBehavior}" is not valid for an app-plan switch`,
        );
      }
      return {
        kind: "app-plan",
        freePlanId: args.freePlanId,
        ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
        ...(args.updateBehavior
          ? {
              updateBehavior: args.updateBehavior as Infer<
                typeof freePlanUpdateBehaviorValidator
              >,
            }
          : {}),
      };
    }
  }
};

/**
 * Convex arg validator for subscription cancellation.
 * Matches the args sent by `<Subscription.Root>` cancel button.
 */
export const subscriptionCancelArgs = {
  subscriptionId: v.optional(v.string()),
  revokeImmediately: v.optional(v.boolean()),
};

/**
 * Convex arg validator for subscription resume.
 * Matches the args sent by `<Subscription.Root>` resume button.
 */
export const subscriptionResumeArgs = {
  subscriptionId: v.optional(v.string()),
};

export const subscriptionCancelScheduledUpdateArgs = {
  subscriptionId: v.optional(v.string()),
};

/**
 * Convex arg validator for subscription pause.
 * Matches the args sent by `<Subscription.Root>` pause button.
 */
export const subscriptionPauseArgs = {
  subscriptionId: v.optional(v.string()),
};

/**
 * Convex arg validator for app-owned plan activation.
 * Matches the args sent by `<Subscription.Root>` for `category: "free"`,
 * `category: "trial"`, and other custom app-owned plans.
 */
export const appPlanActivateArgs = {
  planId: v.string(),
};

/**
 * Convex arg validator for transaction history search.
 * Matches the args sent by `<BillingHistory>` widgets.
 */
export const transactionsSearchArgs = {
  orderId: v.optional(v.string()),
  productId: v.optional(v.string()),
  pageNumber: v.optional(v.number()),
  pageSize: v.optional(v.number()),
};

/**
 * Convex arg validator for listing the current entity's default credit entries.
 * The account is resolved server-side and cannot be selected by the client.
 */
export const creditsListEntriesArgs = {
  limit: v.optional(v.number()),
  startingAfter: v.optional(v.string()),
};

// ── Derived TypeScript types ──────────────────────────────────────────

export type CheckoutCreateArgs = ObjectType<typeof checkoutCreateArgs>;
export type SubscriptionCancelArgs = ObjectType<typeof subscriptionCancelArgs>;
export type SubscriptionResumeArgs = ObjectType<typeof subscriptionResumeArgs>;
export type SubscriptionCancelScheduledUpdateArgs = ObjectType<
  typeof subscriptionCancelScheduledUpdateArgs
>;
export type SubscriptionPauseArgs = ObjectType<typeof subscriptionPauseArgs>;
export type AppPlanActivateArgs = ObjectType<typeof appPlanActivateArgs>;
export type TransactionsSearchArgs = ObjectType<typeof transactionsSearchArgs>;
export type CreditsListEntriesArgs = ObjectType<typeof creditsListEntriesArgs>;

export type RecurringCycleFromValidator = Infer<typeof recurringCycleValidator>;
export type PaymentRecoveryStateFromValidator = Infer<
  typeof paymentRecoveryStateValidator
>;
export type AvailableActionFromValidator = Infer<
  typeof availableActionValidator
>;
export type BillingSnapshotSubscription = Infer<
  typeof billingSnapshotSubscriptionValidator
>;
export type BillingSnapshotOrder = Infer<typeof billingSnapshotOrderValidator>;
export type AppPlanAssignment = Infer<typeof appPlanAssignmentValidator>;
export type AppPlanActivation = Infer<typeof appPlanActivationValidator>;
export type ScheduledSubscriptionUpdate = Infer<
  typeof scheduledSubscriptionUpdateValidator
>;
export type BillingAccessItem = Infer<typeof billingAccessItemValidator>;
export type BillingSnapshot = Infer<typeof billingSnapshotValidator>;
export type ConnectedProduct = Infer<typeof connectedProductValidator>;
export type ConnectedActiveSubscription = Infer<
  typeof connectedActiveSubscriptionValidator
>;
export type ConnectedBillingUser = Infer<typeof connectedBillingUserValidator>;
export type ConnectedTransaction = Infer<typeof connectedTransactionValidator>;
export type ConnectedPagination = Infer<typeof connectedPaginationValidator>;
export type ConnectedTransactionList = Infer<
  typeof connectedTransactionListValidator
>;
export type CreditBalance = Infer<typeof creditBalanceValidator>;
export type CreditEntry = Infer<typeof creditEntryValidator>;
export type CreditEntryList = Infer<typeof creditEntryListValidator>;
