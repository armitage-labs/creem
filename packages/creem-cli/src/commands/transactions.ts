import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/api';
import { shouldOutputJson } from '../lib/config';
import * as output from '../utils/output';
import type { TuiModuleDescriptor } from '../tui';

// Types based on API response (camelCase from SDK)
interface Transaction {
  id: string;
  mode: string;
  object: string;
  amount: number;
  amountPaid?: number | null;
  discountAmount?: number | null;
  currency: string;
  type: string;
  taxCountry?: string | null;
  taxAmount?: number | null;
  status: string;
  refundedAmount?: number | null;
  order?: string | null;
  subscription?: string | null;
  customer?: string | null;
  description?: string;
  periodStart?: number;
  periodEnd?: number;
  createdAt: number;
}

interface TransactionListResponse {
  items: Transaction[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    nextPage?: number;
    prevPage?: number;
  };
}

/**
 * Formats a Unix timestamp (milliseconds) to a human-readable date.
 * TransactionEntity uses numeric timestamps, not ISO strings.
 */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats transaction status with color
 */
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'paid':
      return chalk.green(status);
    case 'pending':
      return chalk.yellow(status);
    case 'refunded':
    case 'partialrefund':
    case 'chargedback':
    case 'declined':
    case 'void':
      return chalk.red(status);
    case 'uncollectible':
      return chalk.dim(status);
    default:
      return status || '-';
  }
}

/**
 * Formats transaction type with color
 */
function formatType(type: string): string {
  switch (type) {
    case 'payment':
      return chalk.cyan('payment');
    case 'invoice':
      return chalk.magenta('invoice');
    default:
      return type || '-';
  }
}

function formatTransaction(txn: Transaction, jsonFlag?: boolean): void {
  if (shouldOutputJson(jsonFlag)) {
    output.outputJson(txn);
    return;
  }

  output.header('Transaction Details');
  output.newline();

  const data: Record<string, unknown> = {
    ID: txn.id,
    Status: formatStatus(txn.status),
    Type: formatType(txn.type),
    Amount: output.formatCurrency(txn.amount, txn.currency),
    Currency: txn.currency.toUpperCase(),
    Mode: txn.mode,
  };

  if (txn.amountPaid != null) {
    data['Amount Paid'] = output.formatCurrency(txn.amountPaid, txn.currency);
  }
  if (txn.discountAmount != null) {
    data['Discount'] = output.formatCurrency(txn.discountAmount, txn.currency);
  }
  if (txn.taxAmount != null) {
    data['Tax Amount'] = output.formatCurrency(txn.taxAmount, txn.currency);
  }
  if (txn.taxCountry) {
    data['Tax Country'] = txn.taxCountry;
  }
  if (txn.refundedAmount != null) {
    data['Refunded'] = output.formatCurrency(txn.refundedAmount, txn.currency);
  }
  if (txn.order) {
    data['Order'] = txn.order;
  }
  if (txn.subscription) {
    data['Subscription'] = txn.subscription;
  }
  if (txn.customer) {
    data['Customer'] = txn.customer;
  }
  if (txn.description) {
    data['Description'] = txn.description;
  }
  if (txn.periodStart) {
    data['Period Start'] = formatTimestamp(txn.periodStart);
  }
  if (txn.periodEnd) {
    data['Period End'] = formatTimestamp(txn.periodEnd);
  }

  data['Created'] = formatTimestamp(txn.createdAt);

  output.outputKeyValue(data);
}

function getTransactionDetailLines(txn: Transaction): string[] {
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push('');
  lines.push(dl('ID', txn.id));
  lines.push(dl('Status', formatStatus(txn.status)));
  lines.push(dl('Type', formatType(txn.type)));
  lines.push(dl('Amount', output.formatCurrency(txn.amount, txn.currency)));
  lines.push(dl('Currency', txn.currency.toUpperCase()));
  lines.push(dl('Mode', txn.mode));

  if (txn.amountPaid != null) {
    lines.push(dl('Amount Paid', output.formatCurrency(txn.amountPaid, txn.currency)));
  }
  if (txn.discountAmount != null) {
    lines.push(dl('Discount', output.formatCurrency(txn.discountAmount, txn.currency)));
  }
  if (txn.taxAmount != null) {
    lines.push(dl('Tax Amount', output.formatCurrency(txn.taxAmount, txn.currency)));
  }
  if (txn.taxCountry) {
    lines.push(dl('Tax Country', txn.taxCountry));
  }
  if (txn.refundedAmount != null) {
    lines.push(dl('Refunded', output.formatCurrency(txn.refundedAmount, txn.currency)));
  }
  if (txn.order) {
    lines.push(dl('Order', txn.order));
  }
  if (txn.subscription) {
    lines.push(dl('Subscription', txn.subscription));
  }
  if (txn.customer) {
    lines.push(dl('Customer', txn.customer));
  }
  if (txn.description) {
    lines.push(dl('Description', txn.description));
  }
  if (txn.periodStart) {
    lines.push(dl('Period Start', formatTimestamp(txn.periodStart)));
  }
  if (txn.periodEnd) {
    lines.push(dl('Period End', formatTimestamp(txn.periodEnd)));
  }

  lines.push(dl('Created', formatTimestamp(txn.createdAt)));

  return lines;
}

function getTransactionsTuiDescriptor(): TuiModuleDescriptor<Transaction> {
  return {
    name: 'Transactions',
    columns: [
      { header: 'ID', width: 24, value: (t) => output.truncate(t.id, 24) },
      {
        header: 'Amount',
        width: 14,
        value: (t) => output.formatCurrency(t.amount, t.currency),
        align: 'right',
      },
      { header: 'Type', width: 10, value: (t) => formatType(t.type) },
      { header: 'Status', width: 14, value: (t) => formatStatus(t.status) },
      { header: 'Created', width: 'auto', value: (t) => formatTimestamp(t.createdAt) },
    ],
    fetchPage: async (page: number, pageSize: number) => {
      const client = getClient();
      const result = (await client.transactions.search(
        undefined,
        undefined,
        undefined,
        page,
        pageSize,
      )) as unknown as TransactionListResponse;
      const { items, pagination } = result;
      return {
        items,
        hasMore: pagination.nextPage !== undefined,
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
        (t.customer?.toLowerCase().includes(q) || false) ||
        (t.order?.toLowerCase().includes(q) || false) ||
        (t.subscription?.toLowerCase().includes(q) || false) ||
        (t.description?.toLowerCase().includes(q) || false)
      );
    },
  };
}

export function createTransactionsCommand(): Command {
  const command = new Command('transactions')
    .description('Manage transactions')
    .alias('txn')
    .action(async () => {
      const { launchInteractiveMode } = await import('../tui');
      const descriptor = getTransactionsTuiDescriptor();
      await launchInteractiveMode(descriptor);
    });

  // List / search transactions
  command
    .command('list')
    .description('List transactions')
    .option('--page <number>', 'Page number', '1')
    .option('--limit <number>', 'Number of results per page', '20')
    .option('--customer <id>', 'Filter by customer ID')
    .option('--order <id>', 'Filter by order ID')
    .option('--product <id>', 'Filter by product ID')
    .option('--json', 'Output as JSON')
    .action(
      async (options: {
        page: string;
        limit: string;
        customer?: string;
        order?: string;
        product?: string;
        json?: boolean;
      }) => {
        const spinner = ora('Fetching transactions...').start();

        try {
          const client = getClient();
          const result = (await client.transactions.search(
            options.customer,
            options.order,
            options.product,
            parseInt(options.page, 10),
            parseInt(options.limit, 10),
          )) as unknown as TransactionListResponse;

          spinner.stop();

          const { items, pagination } = result;

          if (shouldOutputJson(options.json)) {
            output.outputJson(result);
            return;
          }

          output.newline();

          if (items.length === 0) {
            output.info('No transactions found.');
            return;
          }

          output.outputTable(
            ['ID', 'Amount', 'Type', 'Status', 'Customer', 'Created'],
            items.map((t) => [
              output.truncate(t.id, 24),
              output.formatCurrency(t.amount, t.currency),
              formatType(t.type),
              formatStatus(t.status),
              t.customer || '-',
              formatTimestamp(t.createdAt),
            ]),
          );

          output.newline();
          output.dim(
            `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalRecords} total)`,
          );

          if (pagination.nextPage) {
            output.dim(`Use --page ${pagination.nextPage} for next page`);
          }

          const filters: string[] = [];
          if (options.customer) filters.push(`customer: ${options.customer}`);
          if (options.order) filters.push(`order: ${options.order}`);
          if (options.product) filters.push(`product: ${options.product}`);
          if (filters.length > 0) {
            output.dim(`Filtered by ${filters.join(', ')}`);
          }

          output.newline();
        } catch (error) {
          spinner.stop();
          output.error(
            error instanceof Error ? error.message : 'Failed to fetch transactions',
          );
          process.exit(1);
        }
      },
    );

  // Get transaction by ID
  command
    .command('get <transaction-id>')
    .description('Get transaction details')
    .option('--json', 'Output as JSON')
    .action(async (transactionId: string, options: { json?: boolean }) => {
      const spinner = ora('Fetching transaction...').start();

      try {
        const client = getClient();
        const transaction = (await client.transactions.getById(
          transactionId,
        )) as unknown as Transaction;

        spinner.stop();
        formatTransaction(transaction, options.json);
      } catch (error) {
        spinner.fail('Failed to fetch transaction');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return command;
}
