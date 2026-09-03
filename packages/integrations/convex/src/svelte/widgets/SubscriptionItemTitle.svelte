<script lang="ts">
  import { getSubscriptionItemContext } from "./subscriptionItemContext.js";

  interface Props {
    class?: string;
  }

  let { class: className = "" }: Props = $props();
  const ctx = getSubscriptionItemContext();
  const resolvedClass = $derived(
    ctx.unstyled ? className : `creem-base:font-semibold ${className}`,
  );
</script>

<h3 class={resolvedClass}>{ctx.plan.title}</h3>
