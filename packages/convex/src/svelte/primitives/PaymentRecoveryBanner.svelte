<!--
  @component
  Banner shown while a subscription is in a recoverable failed-payment state,
  prompting the customer to update their payment method.
-->
<script lang="ts">
  import type {
    BillingSnapshotSubscription,
    BillingSnapshot,
    PaymentRecoveryState,
    SubscriptionSnapshot,
  } from "../../core/types.js";
  import { derivePaymentRecoveryState } from "../../core/selectors.js";
  import {
    defaultBillingLabels,
    type BillingLabels,
  } from "../../core/i18n.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    subscriptions?:
      | SubscriptionSnapshot
      | SubscriptionSnapshot[]
      | BillingSnapshotSubscription
      | BillingSnapshotSubscription[]
      | null;
    recoveryState?: PaymentRecoveryState;
    class?: string;
    labels?: BillingLabels;
  }

  let {
    snapshot = null,
    subscriptions = undefined,
    recoveryState: externalState = undefined,
    class: className = "",
    labels = defaultBillingLabels,
  }: Props = $props();

  const state = $derived.by<PaymentRecoveryState>(() => {
    if (externalState) return externalState;
    if (subscriptions !== undefined) {
      return derivePaymentRecoveryState(subscriptions);
    }
    if (snapshot) {
      return snapshot.paymentRecoveryState;
    }
    return "none";
  });

  const isBlocked = $derived(state === "blocked");
  const show = $derived(state !== "none");
</script>

{#if show}
  <div
    role="alert"
    class={`body-m radius-m border px-4 py-3 ${
      isBlocked
        ? "border-error-border-subtle bg-error-surface-subtle text-error-foreground-default"
        : "border-warning-border-subtle bg-warning-surface-subtle text-warning-foreground-default"
    } ${className}`}
  >
    {#if isBlocked}
      {labels.paymentRecovery.blocked}
    {:else}
      {labels.paymentRecovery.warning}
    {/if}
  </div>
{/if}
