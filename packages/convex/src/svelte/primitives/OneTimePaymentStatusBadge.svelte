<script lang="ts">
  /* global $props */
  import type { OneTimePaymentStatus } from "../../core/types.js";

  interface Props {
    status: OneTimePaymentStatus;
    className?: string;
  }

  let { status, className = "" }: Props = $props();

  const labels: Record<OneTimePaymentStatus, string> = {
    pending: "Pending",
    paid: "Paid",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
  };
</script>

<span class={className}>{labels[status]}</span>
