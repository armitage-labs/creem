<script lang="ts">
  import { getContext, untrack } from "svelte";
  import type { RecurringCycle } from "../../core/types.js";
  import {
    SUBSCRIPTION_CONTEXT_KEY,
    type SubscriptionContextValue,
  } from "./subscriptionContext.js";
  type BaseProps = {
    planId?: string;
    title?: string;
    description?: string;
    recommended?: boolean;
  };

  type Props =
    | (BaseProps & { type: "free"; productIds?: undefined; contactUrl?: string })
    | (BaseProps & { type: "single"; productIds: Partial<Record<RecurringCycle, string>>; contactUrl?: string })
    | (BaseProps & { type: "seat-based"; productIds: Partial<Record<RecurringCycle, string>>; contactUrl?: string })
    | (BaseProps & { type: "enterprise"; productIds?: undefined; contactUrl: string });

  let {
    planId = undefined,
    type,
    title = undefined,
    description = undefined,
    contactUrl = undefined,
    recommended = undefined,
    productIds = undefined,
  }: Props = $props();

  // Must be used inside a <Subscription.Root>
  const rootContext = getContext<SubscriptionContextValue | undefined>(
    SUBSCRIPTION_CONTEXT_KEY,
  );

  if (rootContext) {
    $effect(() => {
      const resolvedPlanId = planId ?? Object.values(productIds ?? {})[0] ?? type;
      const registration = {
        planId: resolvedPlanId,
        type,
        title,
        description,
        contactUrl,
        recommended,
        productIds,
      };
      const unregister = untrack(() => rootContext.registerPlan(registration));
      return () => untrack(unregister);
    });
  }
</script>
