type SubscriptionLifecycleSdk = {
  subscriptions: {
    get: (subscriptionId: string) => Promise<{ status: string }>;
    resume: (subscriptionId: string) => Promise<unknown>;
  };
};

/**
 * Resume a paused or scheduled-cancel subscription when necessary.
 *
 * Both the explicit lifecycle action and the subscription-update action use
 * this helper. Callers still own scheduling: a workflow must schedule exactly
 * one action that invokes it.
 */
export const resumeSubscriptionIfNeeded = async (
  sdk: SubscriptionLifecycleSdk,
  subscriptionId: string,
): Promise<boolean> => {
  const live = await sdk.subscriptions.get(subscriptionId);
  if (live.status === "active") {
    return true;
  }
  if (live.status !== "scheduled_cancel" && live.status !== "paused") {
    return false;
  }
  await sdk.subscriptions.resume(subscriptionId);
  return true;
};

/**
 * Resolve local compensation after an update workflow attempted a resume.
 *
 * Once Creem has resumed successfully, a later upgrade failure must keep the
 * local subscription active and must not resurrect the old scheduled
 * app-plan transition. If resume itself failed, restoring that transition is
 * still the correct rollback.
 */
export const resolveUpdateFailureAfterResume = ({
  cancellationWasCleared,
  previousStatus,
  previousCancelAtPeriodEnd,
}: {
  cancellationWasCleared: boolean;
  previousStatus?: string;
  previousCancelAtPeriodEnd?: boolean;
}) =>
  cancellationWasCleared
    ? {
        previousStatus: "active",
        previousCancelAtPeriodEnd: false,
        restoreAppPlanTransitions: false,
      }
    : {
        previousStatus,
        previousCancelAtPeriodEnd,
        restoreAppPlanTransitions: true,
      };
