<script lang="ts">
  /* global $props, $derived */
  import type { BillingSnapshot, PaymentSnapshot } from "../../core/types.js";

  interface Props {
    snapshot?: BillingSnapshot | null;
    payment?: PaymentSnapshot | null;
    className?: string;
  }

  let { snapshot = null, payment = null, className = "" }: Props = $props();

  const activePayment = $derived(payment ?? snapshot?.payment ?? null);
  const show = $derived(activePayment != null && activePayment.status !== "paid");
  const message = $derived(
    activePayment?.status === "pending"
      ? "Your payment is pending confirmation. Wait for webhook confirmation before granting permanent access."
      : activePayment?.status === "partially_refunded"
        ? "This payment was partially refunded. Review entitlements that depend on purchase amount."
        : "This payment was refunded. Access should generally be revoked or downgraded.",
  );
</script>

{#if show}
  <div
    class={`rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 ${className}`}
  >
    {message}
  </div>
{/if}
