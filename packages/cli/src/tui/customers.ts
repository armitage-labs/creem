import type { CustomerEntity as Customer } from "creem/models/components";
import type { CliContext } from "../lib/context";
import chalk from "chalk";
import * as output from "../utils/output";
import type { TuiModuleDescriptor } from "../tui";

// Types based on API response (camelCase from SDK)

function getCustomerDetailLines(customer: Customer): string[] {
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push("");
  lines.push(dl("ID", customer.id));
  lines.push(dl("Email", customer.email));
  lines.push(dl("Name", customer.name || chalk.dim("-")));
  lines.push(dl("Country", customer.country || chalk.dim("-")));
  lines.push(dl("Mode", customer.mode));
  lines.push(dl("Created", output.formatDate(customer.createdAt)));
  lines.push(dl("Updated", output.formatDate(customer.updatedAt)));

  return lines;
}

export function getCustomersTuiDescriptor(context: CliContext): TuiModuleDescriptor<Customer> {
  return {
    name: "Customers",
    columns: [
      { header: "ID", width: 24, value: (c) => output.truncate(c.id, 24) },
      {
        header: "Email",
        width: 30,
        value: (c) => output.truncate(c.email, 30),
      },
      { header: "Name", width: 20, value: (c) => c.name || "-" },
      { header: "Country", width: 10, value: (c) => c.country || "-" },
      {
        header: "Created",
        width: "auto",
        value: (c) => output.formatDate(c.createdAt),
      },
    ],
    fetchPage: async (page: number, pageSize: number) => {
      const client = context.client({});
      const result = await client.customers.list(page, pageSize);
      const { items, pagination } = result.result;
      return {
        items,
        hasMore: pagination.currentPage < pagination.totalPages,
        total: pagination.totalRecords,
      };
    },
    getId: (c) => c.id,
    renderDetail: (c) => getCustomerDetailLines(c),
    commands: [
      {
        name: "billing",
        description: "Generate billing portal link",
        requiresSelection: true,
        execute: async (item) => {
          const client = context.client({});
          const result = await client.customers.generateBillingLinks({
            customerId: item!.id,
          });
          return {
            success: true,
            message: `Portal link: ${result.customerPortalLink}`,
          };
        },
      },
    ],
    searchFilter: (c, query) => {
      const q = query.toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        false ||
        c.country?.toLowerCase().includes(q) ||
        false
      );
    },
  };
}
