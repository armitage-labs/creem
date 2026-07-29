<!--
  @component
  Paginated transaction history backed by Creem's transaction search endpoint.

  Renders transaction rows only; invoice and receipt documents are not included.
  Requires `transactions.search` in the connected API.
-->
<script lang="ts">
  import { getContext } from "svelte";
  import { useConvexClient } from "convex-svelte";
  import { Pagination } from "@ark-ui/svelte/pagination";
  import type {
    PaginationPageChangeDetails,
    UsePaginationContext,
  } from "@ark-ui/svelte/pagination";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import type {
    ConnectedTransaction,
    ConnectedTransactionList,
  } from "./types.js";
  import { formatPrice } from "../../core/display.js";
  import { resolveBillingI18n } from "../../core/i18n.js";
  import { getConvexErrorMessage } from "../../core/convexError.js";
  import {
    CREEM_CONVEX_CONTEXT_KEY,
    type CreemConvexContextValue,
  } from "../creemConvexContext.js";

  interface Props {
    /** Transactions per page. */
    pageSize?: number;
    /** Optional product filter passed to the transaction search action. */
    productId?: string;
    /** Optional order filter passed to the transaction search action. */
    orderId?: string;
    /** Wrapper CSS class. */
    class?: string;
  }

  let {
    pageSize = 10,
    productId = undefined,
    orderId = undefined,
    class: className = "",
  }: Props = $props();

  const client = useConvexClient();
  const provider = getContext<CreemConvexContextValue | undefined>(
    CREEM_CONVEX_CONTEXT_KEY,
  );
  const resolvedApi = provider?.api;
  if (!resolvedApi) {
    throw new Error(
      "BillingHistory must be rendered inside <CreemConvexProvider>.",
    );
  }
  const searchRef = resolvedApi.transactions?.search;
  const i18n = $derived(resolveBillingI18n(provider?.i18n));

  let pageNumber = $state(1);
  let result = $state<ConnectedTransactionList | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const normalizeTimestamp = (timestamp: number | undefined): number | null => {
    if (!timestamp) return null;
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  };

  const formatTransactionDate = (timestamp: number | undefined) => {
    const normalized = normalizeTimestamp(timestamp);
    if (!normalized) return i18n.labels.billingHistory.unknown;
    return i18n.formatDate({ date: new Date(normalized) });
  };

  const formatStatus = (value: string) =>
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const getAmount = (transaction: ConnectedTransaction) =>
    transaction.amountPaid ?? transaction.amount;

  const paginationItemClassName = (isCurrentPage: boolean) =>
    `${isCurrentPage ? "button-filled" : "button-faded"} h-8 min-w-8 px-2`;

  const loadTransactions = async (args: {
    pageNumber: number;
    pageSize: number;
    productId?: string;
    orderId?: string;
  }) => {
    if (!searchRef) return;
    isLoading = true;
    error = null;
    try {
      result = (await client.action(
        searchRef,
        args,
      )) as ConnectedTransactionList;
    } catch (cause) {
      error = getConvexErrorMessage(
        cause,
        i18n.labels.billingHistory.loadError,
      );
    } finally {
      isLoading = false;
    }
  };

  $effect(() => {
    void loadTransactions({
      pageNumber,
      pageSize,
      ...(productId ? { productId } : {}),
      ...(orderId ? { orderId } : {}),
    });
  });

  const transactions = $derived(result?.items ?? []);
  const pagination = $derived(result?.pagination);

  type PaginationPageItem =
    | { type: "page"; value: number }
    | { type: "ellipsis" };
  type PaginationApi = {
    page: number;
    pages: PaginationPageItem[];
  };

  const getPaginationApi = (api: UsePaginationContext): PaginationApi =>
    api() as unknown as PaginationApi;
</script>

{#snippet paginationItems(api: UsePaginationContext)}
  {@const paginationApi = getPaginationApi(api)}
  {#each paginationApi.pages as page, index (`${page.type}-${page.type === "page" ? page.value : index}`)}
    {#if page.type === "page"}
      <Pagination.Item
        type="page"
        value={page.value}
        class={paginationItemClassName(page.value === paginationApi.page)}
      >
        {page.value}
      </Pagination.Item>
    {:else}
      <Pagination.Ellipsis
        index={index}
        class="body-s px-1 text-foreground-muted"
      >
        ...
      </Pagination.Ellipsis>
    {/if}
  {/each}
{/snippet}

{#if searchRef}
  <section class={`space-y-3 ${className}`}>
    <div class="flex items-center justify-between gap-3">
      <h2 class="title-m text-foreground-default">{i18n.labels.billingHistory.title}</h2>
      {#if isLoading}
        <span class="body-s text-foreground-placeholder">{i18n.labels.billingHistory.loading}</span>
      {/if}
    </div>

    {#if error}
      <div class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    {/if}

    <div class="overflow-hidden rounded-xl border border-border-subtle">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] border-collapse text-left">
          <thead class="bg-surface-subtle">
            <tr class="label-s text-foreground-muted">
              <th class="px-4 py-3 font-medium">{i18n.labels.billingHistory.columns.date}</th>
              <th class="px-4 py-3 font-medium">{i18n.labels.billingHistory.columns.description}</th>
              <th class="px-4 py-3 font-medium">{i18n.labels.billingHistory.columns.type}</th>
              <th class="px-4 py-3 font-medium">{i18n.labels.billingHistory.columns.status}</th>
              <th class="px-4 py-3 text-right font-medium">{i18n.labels.billingHistory.columns.amount}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle bg-surface-base">
            {#if transactions.length > 0}
              {#each transactions as transaction (transaction.id)}
                <tr class="body-s text-foreground-default">
                  <td class="px-4 py-3">{formatTransactionDate(transaction.createdAt)}</td>
                  <td class="px-4 py-3">{transaction.description ?? transaction.id}</td>
                  <td class="px-4 py-3">{formatStatus(transaction.type)}</td>
                  <td class="px-4 py-3">{formatStatus(transaction.status)}</td>
                  <td class="px-4 py-3 text-right">
                    {formatPrice(getAmount(transaction), transaction.currency, i18n.formatCurrency)}
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td
                  colspan="5"
                  class="px-4 py-8 text-center body-s text-foreground-muted"
                >
                  {isLoading ? i18n.labels.billingHistory.loadingHistory : i18n.labels.billingHistory.empty}
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>

    {#if pagination && pagination.totalPages > 1}
      <Pagination.Root
        count={pagination.totalRecords}
        page={pagination.currentPage}
        {pageSize}
        siblingCount={1}
        onPageChange={(details: PaginationPageChangeDetails) => {
          pageNumber = details.page;
        }}
        class={`flex items-center justify-end gap-2 ${isLoading ? "pointer-events-none opacity-60" : ""}`}
      >
        <Pagination.PrevTrigger
          class="icon-button-ghost-sm"
          aria-label={i18n.labels.accessibility.previousPage}
        >
          <ChevronLeft aria-hidden="true" class="size-4" />
        </Pagination.PrevTrigger>
        <Pagination.Context render={paginationItems} />
        <Pagination.NextTrigger
          class="icon-button-ghost-sm"
          aria-label={i18n.labels.accessibility.nextPage}
        >
          <ChevronRight aria-hidden="true" class="size-4" />
        </Pagination.NextTrigger>
      </Pagination.Root>
    {/if}
  </section>
{/if}
