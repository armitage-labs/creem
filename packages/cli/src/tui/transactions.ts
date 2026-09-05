import type { TransactionEntity as Transaction } from "creem/models/components";
import type { CliContext } from "../lib/context";
import chalk from "chalk";
import * as output from "../utils/output";
import type { TuiModuleDescriptor } from "../tui";

// Types based on API response (camelCase from SDK)

/**
 * Formats a Unix timestamp (milliseconds) to a human-readable date.
 * TransactionEntity uses numeric timestamps, not ISO strings.
 */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats transaction status with color
 */
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case "paid":
      return chalk.green(status);
    case "pending":
      return chalk.yellow(status);
    case "refunded":
    case "partialrefund":
    case "chargedback":
    case "declined":
    case "void":
      return chalk.red(status);
    case "uncollectible":
      return chalk.dim(status);
    default:
      return status || "-";
  }
}

/**
 * Formats transaction type with color
 */
function formatType(type: string): string {
  switch (type) {
    case "payment":
      return chalk.cyan("payment");
    case "invoice":
      return chalk.magenta("invoice");
    default:
      return type || "-";
  }
}

function getTransactionDetailLines(txn: Transaction): string[] {
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push("");
  lines.push(dl("ID", txn.id));
  lines.push(dl("Status", formatStatus(txn.status)));
  lines.push(dl("Type", formatType(txn.type)));
  lines.push(dl("Amount", output.formatCurrency(txn.amount, txn.currency)));
  lines.push(dl("Currency", txn.currency.toUpperCase()));
  lines.push(dl("Mode", txn.mode));

  if (txn.amountPaid != null) {
    lines.push(dl("Amount Paid", output.formatCurrency(txn.amountPaid, txn.currency)));
  }
  if (txn.discountAmount != null) {
    lines.push(dl("Discount", output.formatCurrency(txn.discountAmount, txn.currency)));
  }
  if (txn.taxAmount != null) {
    lines.push(dl("Tax Amount", output.formatCurrency(txn.taxAmount, txn.currency)));
  }
  if (txn.taxCountry) {
    lines.push(dl("Tax Country", txn.taxCountry));
  }
  if (txn.refundedAmount != null) {
    lines.push(dl("Refunded", output.formatCurrency(txn.refundedAmount, txn.currency)));
  }
  if (txn.order) {
    lines.push(dl("Order", txn.order));
  }
  if (txn.subscription) {
    lines.push(dl("Subscription", txn.subscription));
  }
  if (txn.customer) {
    lines.push(dl("Customer", txn.customer));
  }
  if (txn.description) {
    lines.push(dl("Description", txn.description));
  }
  if (txn.periodStart) {
    lines.push(dl("Period Start", formatTimestamp(txn.periodStart)));
  }
  if (txn.periodEnd) {
    lines.push(dl("Period End", formatTimestamp(txn.periodEnd)));
  }

  lines.push(dl("Created", formatTimestamp(txn.createdAt)));

  return lines;
}

export function getTransactionsTuiDescriptor(
  context: CliContext,
): TuiModuleDescriptor<Transaction> {
  return {
    name: "Transactions",
    columns: [
      { header: "ID", width: 24, value: (t) => output.truncate(t.id, 24) },
      {
        header: "Amount",
        width: 14,
        value: (t) => output.formatCurrency(t.amount, t.currency),
        align: "right",
      },
      { header: "Type", width: 10, value: (t) => formatType(t.type) },
      { header: "Status", width: 14, value: (t) => formatStatus(t.status) },
      {
        header: "Created",
        width: "auto",
        value: (t) => formatTimestamp(t.createdAt),
      },
    ],
    fetchPage: async (page: number, pageSize: number) => {
      const client = context.client({});
      const result = await client.transactions.search(
        undefined,
        undefined,
        undefined,
        page,
        pageSize,
      );
      const { items, pagination } = result.result;
      return {
        items,
        hasMore: pagination.currentPage < pagination.totalPages,
        total: pagination.totalRecords,
      };
    },
    getId: (t) => t.id,
    renderDetail: (t) => getTransactionDetailLines(t),
    commands: [],
    searchFilter: (t, query) => {
      const q = query.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.customer?.toLowerCase().includes(q) ||
        false ||
        t.order?.toLowerCase().includes(q) ||
        false ||
        t.subscription?.toLowerCase().includes(q) ||
        false ||
        t.description?.toLowerCase().includes(q) ||
        false
      );
    },
  };
}
