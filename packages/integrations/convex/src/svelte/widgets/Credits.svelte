<script lang="ts">
  import { getContext, setContext, type Snippet } from "svelte";
  import { useConvexClient } from "convex-svelte";
  import CreditsAmount from "./CreditsAmount.svelte";
  import CreditsError from "./CreditsError.svelte";
  import CreditsRefresh from "./CreditsRefresh.svelte";
  import CreditsTitle from "./CreditsTitle.svelte";
  import {
    CREDITS_CONTEXT_KEY,
    type CreditsContextValue,
  } from "./creditsContext.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";

  interface Props {
    /** Unit label displayed next to the balance, such as `credits` or `tokens`. */
    unitLabel?: string;
    /** Wrapper CSS class. */
    class?: string;
    /** Optional custom balance UI. Receives the credits context value. */
    children?: Snippet<[CreditsContextValue]>;
  }

  let {
    unitLabel = "credits",
    class: className = "",
    children,
  }: Props = $props();

  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      "Credits.Root must be rendered inside <CreemConvexProvider>.",
    );
  }

  const client = useConvexClient();
  const getBalanceRef = resolvedApi.credits?.getBalance;
  const i18n = $derived(resolveBillingI18n(provider?.i18n));

  let balance = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  type CreditsBalanceResult = {
    balance?: string | null;
  };

  async function refreshBalance() {
    if (!getBalanceRef) {
      error = i18n.labels.credits.apiNotConfigured;
      return;
    }
    loading = true;
    error = null;
    try {
      const result = (await client.action(getBalanceRef, {})) as unknown;
      const balanceResult = result as CreditsBalanceResult;
      balance = balanceResult.balance ?? "0";
    } catch (cause: unknown) {
      error = getConvexErrorMessage(cause, i18n.labels.credits.loadFailed);
    } finally {
      loading = false;
    }
  }

  const contextValue: CreditsContextValue = {
    get balance() {
      return balance;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get unitLabel() {
      return unitLabel;
    },
    get labels() {
      return i18n.labels;
    },
    refresh: refreshBalance,
  };

  setContext(CREDITS_CONTEXT_KEY, contextValue);

  $effect(() => {
    void refreshBalance();
  });
</script>

<section
  class={`w-full max-w-sm space-y-4 radius-xl border border-border-subtle bg-surface-base p-6 text-foreground-default ${className}`}
>
  {#if children}
    {@render children(contextValue)}
  {:else}
    <div class="flex items-center justify-between gap-3">
      <CreditsTitle />
      <CreditsRefresh />
    </div>
    <CreditsAmount />
    <CreditsError />
  {/if}
</section>
