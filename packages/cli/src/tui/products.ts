import type { ProductEntity as Product } from "creem/models/components";
import type { CliContext } from "../lib/context";
import chalk from "chalk";
import * as output from "../utils/output";
import type { TuiModuleDescriptor } from "../tui";

/**
 * Formats billing info for display
 */
function formatBilling(product: Product): string {
  if (product.billingType === "onetime") {
    return "One-time";
  }
  const period = product.billingPeriod?.replace("every-", "") || "month";
  return `Recurring / ${period}`;
}

/**
 * Formats product status with color
 */
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
      return chalk.green(status);
    case "archived":
      return chalk.yellow(status);
    case "draft":
      return chalk.dim(status);
    default:
      return status || "-";
  }
}

function getProductDetailLines(product: Product): string[] {
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push("");
  lines.push(dl("ID", product.id));
  lines.push(dl("Name", product.name));
  lines.push(dl("Status", formatStatus(product.status)));
  lines.push(dl("Price", output.formatCurrency(product.price, product.currency)));
  lines.push(dl("Currency", product.currency.toUpperCase()));
  lines.push(dl("Billing", formatBilling(product)));
  lines.push(dl("Tax Mode", product.taxMode));
  lines.push(dl("Tax Category", product.taxCategory));
  lines.push(dl("Mode", product.mode));
  lines.push(dl("Created", output.formatDate(product.createdAt)));
  lines.push(dl("Updated", output.formatDate(product.updatedAt)));

  if (product.description) {
    lines.push("");
    lines.push(chalk.dim("Description:"));
    lines.push(product.description);
  }

  if (product.productUrl) {
    lines.push("");
    lines.push(chalk.dim("Product URL:"));
    lines.push(chalk.cyan(product.productUrl));
  }

  if (product.features && product.features.length > 0) {
    lines.push("");
    lines.push(chalk.dim("Features:"));
    for (const f of product.features) {
      lines.push(`  \u2022 ${f.type}: ${f.description}`);
    }
  }

  return lines;
}

export function getProductsTuiDescriptor(context: CliContext): TuiModuleDescriptor<Product> {
  return {
    name: "Products",
    columns: [
      { header: "ID", width: 24, value: (p) => p.id },
      { header: "Name", width: 30, value: (p) => output.truncate(p.name, 30) },
      {
        header: "Price",
        width: 14,
        value: (p) => output.formatCurrency(p.price, p.currency),
        align: "right",
      },
      { header: "Billing", width: 18, value: (p) => formatBilling(p) },
      { header: "Status", width: "auto", value: (p) => formatStatus(p.status) },
    ],
    fetchPage: async (page: number, pageSize: number) => {
      const client = context.client({});
      const response = await client.products.search(page, pageSize);
      const { items, pagination } = response.result;
      return {
        items,
        hasMore: pagination.currentPage < pagination.totalPages,
        total: pagination.totalRecords,
      };
    },
    getId: (p) => p.id,
    renderDetail: (p) => getProductDetailLines(p),
    commands: [],
    searchFilter: (p, query) => {
      const q = query.toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
      );
    },
  };
}
