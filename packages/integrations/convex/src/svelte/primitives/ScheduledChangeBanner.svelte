<!--
  @component
  Notice for a scheduled cancellation or an app-side period-end update.

  Inside a connected provider, pass `subscriptionId` and the widget derives the
  period, the pending update, its label, and the undo/resume handlers from the
  billing model. The remaining props are overrides for unconnected use.
-->
<script lang="ts">
  /* global $props, $derived */
  import { getContext } from "svelte";
  import { useConvexClient, useQuery } from "convex-svelte";
  import {
    type BillingDateFormatInput,
    type BillingLabels,
    type BillingCurrencyFormatInput,
    resolveBillingI18n,
  } from "../../core/i18n.js";
  import {
    findPlanById,
    findPlanByProductId,
    normalizePlanCatalog,
  } from "../../core/catalog.js";
  import { formatPriceWithInterval } from "../../core/display.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import type {
    ConnectedBillingModel,
    ConnectedProduct,
  } from "../widgets/types.js";

  type BannerScheduledUpdate = {
    effectiveAt?: unknown;
    targetProductId?: string;
    targetPlanId?: string;
    targetUnits?: number;
  };

  interface Props {
    subscriptionId?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
    scheduledUpdate?: BannerScheduledUpdate | null;
    className?: string;
    isLoading?: boolean;
    onResume?: () => void;
    onUndoUpdate?: () => void;
    scheduledUpdateLabel?: string | null;
    labels?: BillingLabels;
    formatDate?: (input: BillingDateFormatInput) => string;
    formatCurrency?: (input: BillingCurrencyFormatInput) => string;
  }

  let {
    subscriptionId = undefined,
    cancelAtPeriodEnd = undefined,
    currentPeriodEnd = undefined,
    scheduledUpdate = undefined,
    className = "",
    isLoading = false,
    onResume = undefined,
    onUndoUpdate = undefined,
    scheduledUpdateLabel = undefined,
    labels = undefined,
    formatDate = undefined,
    formatCurrency = undefined,
  }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const client = provider ? useConvexClient() : null;
  const billingModelQuery = provider?.api.uiModel
    ? useQuery(provider.api.uiModel, () =>
        subscriptionId &&
        (cancelAtPeriodEnd === undefined ||
          currentPeriodEnd === undefined ||
          scheduledUpdate === undefined ||
          scheduledUpdateLabel === undefined)
          ? {}
          : "skip",
      )
    : null;
  let defaultActionLoading = $state(false);

  const model = $derived(
    (billingModelQuery?.data ?? null) as ConnectedBillingModel | null,
  );
  const providerI18n = $derived(resolveBillingI18n(provider?.i18n));
  const resolvedLabels = $derived(labels ?? providerI18n.labels);
  const resolvedFormatDate = $derived(formatDate ?? providerI18n.formatDate);
  const resolvedFormatCurrency = $derived(
    formatCurrency ?? providerI18n.formatCurrency,
  );
  const canResume = $derived(
    provider?.permissions?.canResumeSubscription !== false,
  );
  const resumeRef = $derived(provider?.api.subscriptions?.resume);
  const cancelScheduledUpdateRef = $derived(
    provider?.api.subscriptions?.cancelScheduledUpdate,
  );

  const matchedSubscription = $derived(
    subscriptionId
      ? ((model?.activeSubscriptions ?? []).find(
          (subscription) => subscription.id === subscriptionId,
        ) ?? null)
      : null,
  );
  const matchedScheduledUpdate = $derived(
    subscriptionId
      ? ((model?.scheduledSubscriptionUpdates ?? []).find(
          (update) => update.subscriptionId === subscriptionId,
        ) ?? null)
      : null,
  );
  const normalizedCatalog = $derived(
    normalizePlanCatalog(model?.catalog ?? provider?.catalog),
  );
  const allProducts = $derived(model?.allProducts ?? []);
  const resolvedCancelAtPeriodEnd = $derived(
    cancelAtPeriodEnd ?? matchedSubscription?.cancelAtPeriodEnd ?? false,
  );
  const resolvedCurrentPeriodEnd = $derived(
    currentPeriodEnd ?? matchedSubscription?.currentPeriodEnd ?? null,
  );
  const resolvedScheduledUpdate = $derived<BannerScheduledUpdate | null>(
    scheduledUpdate === undefined ? matchedScheduledUpdate : scheduledUpdate,
  );
  const hasScheduledUpdate = $derived(resolvedScheduledUpdate != null);
  const show = $derived(
    resolvedCancelAtPeriodEnd || hasScheduledUpdate,
  );
  const resolvedIsLoading = $derived(isLoading || defaultActionLoading);
  const defaultResume = $derived(
    !onResume && resumeRef && canResume ? resumeSubscription : undefined,
  );
  const defaultUndoUpdate = $derived(
    !onUndoUpdate && cancelScheduledUpdateRef && canResume
      ? cancelScheduledUpdate
      : undefined,
  );
  const resolvedOnResume = $derived(onResume ?? defaultResume);
  const resolvedOnUndoUpdate = $derived(onUndoUpdate ?? defaultUndoUpdate);
  const resolvedPeriodEnd = $derived(
    hasScheduledUpdate &&
      typeof resolvedScheduledUpdate?.effectiveAt === "string"
      ? resolvedScheduledUpdate.effectiveAt
      : resolvedCurrentPeriodEnd,
  );
  const formattedPeriodEnd = $derived(
    resolvedPeriodEnd
      ? resolvedFormatDate({
          date: new Date(resolvedPeriodEnd),
        })
      : undefined,
  );
  const resolvedScheduledUpdateLabel = $derived(
    scheduledUpdateLabel === undefined
      ? deriveScheduledUpdateLabel(
          resolvedScheduledUpdate,
          normalizedCatalog,
          allProducts,
        )
      : scheduledUpdateLabel,
  );

  async function resumeSubscription() {
    if (!client || !resumeRef) return;
    defaultActionLoading = true;
    try {
      await client.mutation(resumeRef, {
        ...(subscriptionId ? { subscriptionId } : {}),
      });
    } catch (error) {
      console.error("Resume subscription failed:", error);
    } finally {
      defaultActionLoading = false;
    }
  }

  async function cancelScheduledUpdate() {
    if (!client || !cancelScheduledUpdateRef) return;
    defaultActionLoading = true;
    try {
      await client.mutation(cancelScheduledUpdateRef, {
        ...(subscriptionId ? { subscriptionId } : {}),
      });
    } catch (error) {
      console.error("Cancel scheduled subscription update failed:", error);
    } finally {
      defaultActionLoading = false;
    }
  }

  function deriveScheduledUpdateLabel(
    update: BannerScheduledUpdate | null,
    catalog: ReturnType<typeof normalizePlanCatalog>,
    products: ConnectedProduct[],
  ): string | null {
    if (!update) return null;

    if (update.targetProductId) {
      const targetPlan = findPlanByProductId(catalog, update.targetProductId);
      const price = formatPriceWithInterval(
        update.targetProductId,
        products,
        resolvedLabels,
        resolvedFormatCurrency,
      );
      const title =
        targetPlan?.title ??
        products.find((product) => product.id === update.targetProductId)
          ?.name ??
        resolvedLabels.subscription.newPlan;
      return price ? `${title} \u00b7 ${price}` : title;
    }

    if (update.targetPlanId) {
      const targetPlan = findPlanById(catalog, update.targetPlanId);
      return targetPlan?.title ?? update.targetPlanId;
    }

    if (update.targetUnits !== undefined) {
      return resolvedLabels.subscription.unitCount(update.targetUnits);
    }

    return null;
  }
</script>

{#if show}
  <div
    class={`rounded-xl bg-surface-base p-6 ${className}`}
  >
    <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-4">
      <div class="space-y-2">
        <p class="title-s text-foreground-default">
          {hasScheduledUpdate
            ? resolvedLabels.scheduledChange.updateScheduled
            : resolvedLabels.scheduledChange.cancellationScheduled}
        </p>
        <p class="body-m text-foreground-muted">
          {hasScheduledUpdate
            ? resolvedLabels.scheduledChange.updateAtPeriodEnd(formattedPeriodEnd)
            : resolvedLabels.scheduledChange.accessUntilPeriodEnd(formattedPeriodEnd)}
        </p>
        {#if hasScheduledUpdate && resolvedScheduledUpdateLabel}
          <p class="label-m text-foreground-default">
            {resolvedLabels.scheduledChange.targetUpdate(resolvedScheduledUpdateLabel)}
          </p>
        {/if}
      </div>
      {#if hasScheduledUpdate && resolvedOnUndoUpdate}
        <button
          type="button"
          class="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={resolvedIsLoading}
          onclick={resolvedOnUndoUpdate}
        >
          {resolvedIsLoading ? resolvedLabels.scheduledChange.resuming : resolvedLabels.scheduledChange.undoUpdate}
        </button>
      {:else if !hasScheduledUpdate && resolvedOnResume}
        <button
          type="button"
          class="button-faded h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={resolvedIsLoading}
          onclick={resolvedOnResume}
        >
          {resolvedIsLoading ? resolvedLabels.scheduledChange.resuming : resolvedLabels.scheduledChange.undoCancellation}
        </button>
      {/if}
    </div>
  </div>
{/if}
