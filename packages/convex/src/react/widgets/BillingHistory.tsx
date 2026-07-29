import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvex } from "convex/react";
import {
  Pagination,
  type PaginationPageChangeDetails,
  type UsePaginationContext,
} from "@ark-ui/react/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ConnectedTransaction,
  ConnectedTransactionList,
} from "./types.js";
import { formatPrice } from "../../core/display.js";
import { resolveBillingI18n } from "../../core/i18n.js";
import { getConvexErrorMessage } from "../../core/convexError.js";
import {
  requireCreemConvexApi,
  useCreemConvex,
} from "../CreemConvexProvider.js";

const normalizeTimestamp = (timestamp: number | undefined): number | null => {
  if (!timestamp) return null;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

const formatTransactionDate = (
  timestamp: number | undefined,
  i18n: ReturnType<typeof resolveBillingI18n>,
) => {
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

/**
 * Paginated transaction history backed by Creem's transaction search endpoint.
 *
 * Renders transaction rows only; invoice and receipt documents are not included.
 * Requires `transactions.search` in the connected API.
 */
export const BillingHistory = ({
  pageSize = 10,
  productId,
  orderId,
  className = "",
}: {
  /**
   * Transactions per page.
   */
  pageSize?: number;
  /**
   * Show only transactions for this Creem product.
   */
  productId?: string;
  /**
   * Show only transactions for this Creem order.
   */
  orderId?: string;
  /**
   * CSS class for the wrapper element.
   */
  class?: string;
  /**
   * CSS class for the wrapper element.
   */
  className?: string;
}) => {
  const provider = useCreemConvex();
  const i18n = useMemo(
    () => resolveBillingI18n(provider?.i18n),
    [provider?.i18n],
  );
  const resolvedApi = requireCreemConvexApi("BillingHistory", provider);
  const client = useConvex();
  const searchRef = resolvedApi.transactions?.search;
  const [pageNumber, setPageNumber] = useState(1);
  const [result, setResult] = useState<ConnectedTransactionList | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchArgs = useMemo(
    () => ({
      pageNumber,
      pageSize,
      ...(productId ? { productId } : {}),
      ...(orderId ? { orderId } : {}),
    }),
    [orderId, pageNumber, pageSize, productId],
  );

  const loadTransactions = useCallback(async () => {
    if (!searchRef) return;
    setIsLoading(true);
    setError(null);
    try {
      const next = await client.action(searchRef, searchArgs);
      setResult(next as ConnectedTransactionList);
    } catch (cause) {
      setError(
        getConvexErrorMessage(cause, i18n.labels.billingHistory.loadError),
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, i18n.labels.billingHistory.loadError, searchArgs, searchRef]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadTransactions();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadTransactions]);

  if (!searchRef) return null;

  const transactions = result?.items ?? [];
  const pagination = result?.pagination;

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="title-m text-foreground-default">
          {i18n.labels.billingHistory.title}
        </h2>
        {isLoading && (
          <span className="body-s text-foreground-placeholder">
            {i18n.labels.billingHistory.loading}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead className="bg-surface-subtle">
              <tr className="label-s text-foreground-muted">
                <th className="px-4 py-3 font-medium">
                  {i18n.labels.billingHistory.columns.date}
                </th>
                <th className="px-4 py-3 font-medium">
                  {i18n.labels.billingHistory.columns.description}
                </th>
                <th className="px-4 py-3 font-medium">
                  {i18n.labels.billingHistory.columns.type}
                </th>
                <th className="px-4 py-3 font-medium">
                  {i18n.labels.billingHistory.columns.status}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {i18n.labels.billingHistory.columns.amount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface-base">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="body-s text-foreground-default"
                  >
                    <td className="px-4 py-3">
                      {formatTransactionDate(transaction.createdAt, i18n)}
                    </td>
                    <td className="px-4 py-3">
                      {transaction.description ?? transaction.id}
                    </td>
                    <td className="px-4 py-3">
                      {formatStatus(transaction.type)}
                    </td>
                    <td className="px-4 py-3">
                      {formatStatus(transaction.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatPrice(
                        getAmount(transaction),
                        transaction.currency,
                        i18n.formatCurrency,
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center body-s text-foreground-muted"
                  >
                    {isLoading
                      ? i18n.labels.billingHistory.loadingHistory
                      : i18n.labels.billingHistory.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination.Root
          count={pagination.totalRecords}
          page={pagination.currentPage}
          pageSize={pageSize}
          siblingCount={1}
          onPageChange={(details: PaginationPageChangeDetails) =>
            setPageNumber(details.page)
          }
          className={`flex items-center justify-end gap-2 ${isLoading ? "pointer-events-none opacity-60" : ""}`}
        >
          <Pagination.PrevTrigger
            className="icon-button-ghost-sm"
            aria-label={i18n.labels.accessibility.previousPage}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Pagination.PrevTrigger>
          <Pagination.Context>
            {(api: UsePaginationContext) =>
              api.pages.map(
                (page: UsePaginationContext["pages"][number], index: number) =>
                  page.type === "page" ? (
                    <Pagination.Item
                      key={page.value}
                      type="page"
                      value={page.value}
                      className={paginationItemClassName(
                        page.value === api.page,
                      )}
                    >
                      {page.value}
                    </Pagination.Item>
                  ) : (
                    <Pagination.Ellipsis
                      key={`ellipsis-${index}`}
                      index={index}
                      className="body-s px-1 text-foreground-muted"
                    >
                      ...
                    </Pagination.Ellipsis>
                  ),
              )
            }
          </Pagination.Context>
          <Pagination.NextTrigger
            className="icon-button-ghost-sm"
            aria-label={i18n.labels.accessibility.nextPage}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Pagination.NextTrigger>
        </Pagination.Root>
      )}
    </section>
  );
};
