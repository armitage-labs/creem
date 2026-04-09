import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/api';
import { shouldOutputJson } from '../lib/config';
import * as output from '../utils/output';
import type { TuiModuleDescriptor } from '../tui';

// Types based on API response (camelCase from SDK)
interface Customer {
  id: string;
  mode: string;
  object: string;
  email: string;
  name?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerListResponse {
  items: Customer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    nextPage?: number;
  };
}

interface CustomerLinksResponse {
  customerPortalLink: string;
}

function formatCustomer(customer: Customer, jsonFlag?: boolean): void {
  if (shouldOutputJson(jsonFlag)) {
    output.outputJson(customer);
    return;
  }

  output.header('Customer Details');
  output.newline();

  const data: Record<string, unknown> = {
    ID: customer.id,
    Email: customer.email,
    Name: customer.name || chalk.dim('-'),
    Country: customer.country || chalk.dim('-'),
    Mode: customer.mode,
    Created: output.formatDate(customer.createdAt),
    Updated: output.formatDate(customer.updatedAt),
  };

  output.outputKeyValue(data);
}

function getCustomerDetailLines(customer: Customer): string[] {
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push('');
  lines.push(dl('ID', customer.id));
  lines.push(dl('Email', customer.email));
  lines.push(dl('Name', customer.name || chalk.dim('-')));
  lines.push(dl('Country', customer.country || chalk.dim('-')));
  lines.push(dl('Mode', customer.mode));
  lines.push(dl('Created', output.formatDate(customer.createdAt)));
  lines.push(dl('Updated', output.formatDate(customer.updatedAt)));

  return lines;
}

function getCustomersTuiDescriptor(): TuiModuleDescriptor<Customer> {
  return {
    name: 'Customers',
    columns: [
      { header: 'ID', width: 24, value: (c) => output.truncate(c.id, 24) },
      { header: 'Email', width: 30, value: (c) => output.truncate(c.email, 30) },
      { header: 'Name', width: 20, value: (c) => c.name || '-' },
      { header: 'Country', width: 10, value: (c) => c.country || '-' },
      { header: 'Created', width: 'auto', value: (c) => output.formatDate(c.createdAt) },
    ],
    fetchPage: async (page: number, pageSize: number) => {
      const client = getClient();
      const result = (await client.customers.list(page, pageSize)) as unknown as CustomerListResponse;
      const { items, pagination } = result;
      return {
        items,
        hasMore: pagination.nextPage !== undefined,
        total: pagination.totalRecords,
      };
    },
    getId: (c) => c.id,
    renderDetail: (c) => getCustomerDetailLines(c),
    commands: [
      {
        name: 'billing',
        description: 'Generate billing portal link',
        requiresSelection: true,
        execute: async (item) => {
          const client = getClient();
          const result = (await client.customers.generateBillingLinks({
            customerId: item!.id,
          })) as unknown as CustomerLinksResponse;
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
        (c.name?.toLowerCase().includes(q) || false) ||
        (c.country?.toLowerCase().includes(q) || false)
      );
    },
  };
}

export function createCustomersCommand(): Command {
  const command = new Command('customers')
    .description('Manage customers')
    .alias('cust')
    .action(async () => {
      const { launchInteractiveMode } = await import('../tui');
      const descriptor = getCustomersTuiDescriptor();
      await launchInteractiveMode(descriptor);
    });

  // List customers
  command
    .command('list')
    .description('List all customers')
    .option('--page <number>', 'Page number', '1')
    .option('--limit <number>', 'Number of results per page', '20')
    .option('--json', 'Output as JSON')
    .action(async (options: { page: string; limit: string; json?: boolean }) => {
      const spinner = ora('Fetching customers...').start();

      try {
        const client = getClient();
        const result = (await client.customers.list(
          parseInt(options.page, 10),
          parseInt(options.limit, 10)
        )) as unknown as CustomerListResponse;

        spinner.stop();

        const { items, pagination } = result;

        if (shouldOutputJson(options.json)) {
          output.outputJson(result);
          return;
        }

        if (items.length === 0) {
          output.info('No customers found.');
          return;
        }

        // Table output
        const headers = ['ID', 'Email', 'Name', 'Country', 'Created'];
        const rows = items.map((c) => [
          output.truncate(c.id, 24),
          output.truncate(c.email, 30),
          c.name || '-',
          c.country || '-',
          output.formatDate(c.createdAt),
        ]);

        output.outputTable(headers, rows);

        // Pagination info
        output.newline();
        output.dim(
          `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalRecords} total customers)`
        );

        if (pagination.nextPage) {
          output.dim(`Use --page ${pagination.nextPage} for next page`);
        }
      } catch (error) {
        spinner.fail('Failed to fetch customers');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Get customer
  command
    .command('get <id>')
    .description('Get customer details by ID or email')
    .option('--email', 'Treat the argument as an email instead of ID')
    .option('--json', 'Output as JSON')
    .action(async (idOrEmail: string, options: { email?: boolean; json?: boolean }) => {
      const spinner = ora('Fetching customer...').start();

      try {
        const client = getClient();

        // SDK method: retrieve(customerId?, email?)
        const result = options.email
          ? ((await client.customers.retrieve(undefined, idOrEmail)) as unknown as Customer)
          : ((await client.customers.retrieve(idOrEmail)) as unknown as Customer);

        spinner.stop();
        formatCustomer(result, options.json);
      } catch (error) {
        spinner.fail('Failed to fetch customer');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Get billing portal link
  command
    .command('billing <id>')
    .description('Get billing portal link for a customer')
    .option('--json', 'Output as JSON')
    .action(async (customerId: string, options: { json?: boolean }) => {
      const spinner = ora('Generating billing portal link...').start();

      try {
        const client = getClient();
        const result = (await client.customers.generateBillingLinks({
          customerId,
        })) as unknown as CustomerLinksResponse;

        spinner.succeed('Billing portal link generated');

        if (shouldOutputJson(options.json)) {
          output.outputJson(result);
          return;
        }

        output.newline();

        const data: Record<string, unknown> = {
          'Customer ID': customerId,
          'Portal Link': result.customerPortalLink,
        };

        output.outputKeyValue(data);

        output.newline();
        output.dim('This link allows the customer to manage their billing and subscriptions.');
      } catch (error) {
        spinner.fail('Failed to generate billing portal link');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return command;
}
