import type { ConnectedBillingModel } from "./model.js";
import type {
  AppPlanUpdateBehavior,
  PaidSubscriptionUpdateBehavior,
  ResolvedUpdateBehavior,
  SubscriptionUpdateArgs,
} from "./types.js";

export type SubscriptionUpdateCommandInput =
  | { kind: "plan"; productId: string }
  | { kind: "app-plan"; appPlanId: string }
  | { kind: "units"; units: number };

/** Build the exact validated wire command used by both framework adapters. */
export const buildSubscriptionUpdateCommand = ({
  input,
  subscriptionId,
  updateBehavior,
}: {
  input: SubscriptionUpdateCommandInput;
  subscriptionId?: string;
  updateBehavior: ResolvedUpdateBehavior;
}): SubscriptionUpdateArgs => {
  if (input.kind === "app-plan") {
    return {
      kind: "app-plan",
      appPlanId: input.appPlanId,
      ...(subscriptionId ? { subscriptionId } : {}),
      updateBehavior: updateBehavior as AppPlanUpdateBehavior,
    };
  }
  if (input.kind === "plan") {
    return {
      kind: "plan",
      productId: input.productId,
      ...(subscriptionId ? { subscriptionId } : {}),
      updateBehavior: updateBehavior as PaidSubscriptionUpdateBehavior,
    };
  }
  return {
    kind: "units",
    units: input.units,
    ...(subscriptionId ? { subscriptionId } : {}),
    updateBehavior: updateBehavior as PaidSubscriptionUpdateBehavior,
  };
};

/**
 * Project a confirmed update command into the connected query cache.
 *
 * The projection is intentionally framework-free. React and Svelte only adapt
 * it to their respective Convex optimistic-update APIs.
 */
export const applyOptimisticSubscriptionUpdate = ({
  model,
  command,
  subscriptionId,
  currentPeriodEnd,
  now,
}: {
  model: ConnectedBillingModel;
  command: SubscriptionUpdateArgs;
  subscriptionId?: string;
  currentPeriodEnd?: string | null;
  now: string;
}): ConnectedBillingModel => {
  if (command.updateBehavior === "period-end") {
    return {
      ...model,
      scheduledSubscriptionUpdates: [
        ...(model.scheduledSubscriptionUpdates ?? []).filter(
          (scheduled) => scheduled.subscriptionId !== subscriptionId,
        ),
        {
          entityId: "",
          subscriptionId: subscriptionId ?? "",
          ...(command.kind === "plan"
            ? { targetProductId: command.productId }
            : command.kind === "app-plan"
              ? { targetPlanId: command.appPlanId }
              : { targetUnits: command.units }),
          effectiveAt: currentPeriodEnd ?? "",
          status: "pending",
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  if (command.kind === "units") {
    return {
      ...model,
      activeSubscriptions: (model.activeSubscriptions ?? []).map(
        (subscription) =>
          subscription.id === subscriptionId
            ? { ...subscription, units: command.units }
            : subscription,
      ),
    };
  }

  if (command.kind === "plan") {
    return {
      ...model,
      subscriptionProductId: model.activeSubscriptions.some(
        (subscription) => subscription.id === subscriptionId,
      )
        ? command.productId
        : model.subscriptionProductId,
      activeSubscriptions: (model.activeSubscriptions ?? []).map(
        (subscription) =>
          subscription.id === subscriptionId
            ? { ...subscription, productId: command.productId }
            : subscription,
      ),
    };
  }

  const existingAssignment = model.appPlanAssignments.find(
    (assignment) =>
      assignment.subscriptionId === subscriptionId &&
      assignment.planId === command.appPlanId,
  );
  return {
    ...model,
    activePlanId: command.appPlanId,
    subscriptionProductId: null,
    activeSubscriptions: (model.activeSubscriptions ?? []).filter(
      (subscription) => subscription.id !== subscriptionId,
    ),
    appPlanAssignments: [
      ...model.appPlanAssignments
        .filter((assignment) => assignment !== existingAssignment)
        .map((assignment) =>
          assignment.status === "active" || assignment.status === "scheduled"
            ? { ...assignment, status: "ended" as const, endsAt: now }
            : assignment,
        ),
      {
        entityId: existingAssignment?.entityId ?? "",
        planId: command.appPlanId,
        status: "active",
        startsAt: now,
        source: "paid_to_app_plan",
        ...(subscriptionId ? { subscriptionId } : {}),
        createdAt: existingAssignment?.createdAt ?? now,
        updatedAt: now,
      },
    ],
  };
};
