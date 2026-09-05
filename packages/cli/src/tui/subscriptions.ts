import type { SubscriptionEntity as Subscription } from "creem/models/components";
import type { CliContext } from "../lib/context";
import chalk from "chalk";
import * as output from "../utils/output";
import type { TuiModuleDescriptor } from "../tui";

function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    active: chalk.green,
    paused: chalk.yellow,
    canceled: chalk.red,
    unpaid: chalk.red,
    trialing: chalk.cyan,
    scheduled_cancel: chalk.yellow,
  };
  const normalizedStatus = status?.toLowerCase();
  const colorFn = statusColors[normalizedStatus] || chalk.white;
  return colorFn(status);
}

function getSubscriptionDetailLines(sub: Subscription): string[] {
  const product = typeof sub.product === "object" ? sub.product : null;
  const customer = typeof sub.customer === "object" ? sub.customer : null;
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push("");
  lines.push(dl("ID", sub.id));
  lines.push(dl("Status", formatStatus(sub.status)));
  lines.push(dl("Mode", sub.mode));
  lines.push(
    dl(
      "Customer",
      customer
        ? `${customer.email}${customer.name ? ` (${customer.name})` : ""}`
        : (sub.customer as string),
    ),
  );
  lines.push(dl("Customer ID", String(customer?.id || sub.customer)));
  lines.push(dl("Product", String(product?.name || sub.product)));
  lines.push(dl("Product ID", String(product?.id || sub.product)));

  if (product) {
    lines.push(dl("Price", output.formatCurrency(product.price, product.currency)));
    if (product.billingPeriod) {
      lines.push(dl("Billing Period", product.billingPeriod));
    }
  }

  if (sub.currentPeriodStartDate) {
    lines.push(dl("Period Start", output.formatDate(sub.currentPeriodStartDate)));
  }
  if (sub.currentPeriodEndDate) {
    lines.push(dl("Period End", output.formatDate(sub.currentPeriodEndDate)));
  }
  if (sub.nextTransactionDate) {
    lines.push(dl("Next Billing", output.formatDate(sub.nextTransactionDate)));
  }
  if (sub.canceledAt) {
    lines.push(dl("Canceled At", output.formatDate(sub.canceledAt)));
  }

  lines.push(dl("Created", output.formatDate(sub.createdAt)));
  lines.push(dl("Updated", output.formatDate(sub.updatedAt)));

  return lines;
}

export function getSubscriptionsTuiDescriptor(
  context: CliContext,
): TuiModuleDescriptor<Subscription> {
  return {
    name: "Subscriptions",
    columns: [
      { header: "ID", width: 24, value: (s) => s.id },
      {
        header: "Customer",
        width: 28,
        value: (s) => (typeof s.customer === "object" ? s.customer.email : String(s.customer)),
      },
      {
        header: "Product",
        width: 20,
        value: (s) => (typeof s.product === "object" ? s.product.name : String(s.product)),
      },
      { header: "Status", width: 12, value: (s) => formatStatus(s.status) },
      {
        header: "Next Billing",
        width: "auto",
        value: (s) => (s.nextTransactionDate ? output.formatDate(s.nextTransactionDate) : "-"),
      },
    ],
    fetchPage: async (page, pageSize) => {
      const { result } = await context.client({}).subscriptions.search(page, pageSize);
      return {
        items: result.items,
        hasMore: result.pagination.currentPage < result.pagination.totalPages,
        total: result.pagination.totalRecords,
      };
    },
    getId: (s) => s.id,
    renderDetail: (s) => getSubscriptionDetailLines(s),
    commands: [
      {
        name: "cancel",
        description: "Cancel subscription",
        requiresSelection: true,
        destructive: true,
        execute: async (item) => {
          const client = context.client({});
          await client.subscriptions.cancel(item!.id, { mode: "immediate" });
          return {
            success: true,
            message: "Subscription canceled",
            refreshList: true,
          };
        },
      },
      {
        name: "pause",
        description: "Pause subscription",
        requiresSelection: true,
        destructive: true,
        execute: async (item) => {
          const client = context.client({});
          await client.subscriptions.pause(item!.id);
          return {
            success: true,
            message: "Subscription paused",
            refreshList: true,
          };
        },
      },
      {
        name: "resume",
        description: "Resume subscription",
        requiresSelection: true,
        execute: async (item) => {
          const client = context.client({});
          await client.subscriptions.resume(item!.id);
          return {
            success: true,
            message: "Subscription resumed",
            refreshList: true,
          };
        },
      },
    ],
    searchFilter: (s, query) => {
      const q = query.toLowerCase();
      const customer = typeof s.customer === "object" ? s.customer.email : String(s.customer);
      const product = typeof s.product === "object" ? s.product.name : String(s.product);
      return (
        s.id.toLowerCase().includes(q) ||
        customer.toLowerCase().includes(q) ||
        product.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    },
  };
}
