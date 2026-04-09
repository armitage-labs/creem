import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/api';
import { shouldOutputJson } from '../lib/config';
import * as output from '../utils/output';
import type { TuiModuleDescriptor } from '../tui';

// Types based on API response (camelCase from SDK)
interface SubscriptionProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod?: string;
}

interface SubscriptionCustomer {
  id: string;
  email: string;
  name?: string;
}

interface Subscription {
  id: string;
  mode: string;
  object: string;
  status: string;
  product: SubscriptionProduct | string;
  customer: SubscriptionCustomer | string;
  currentPeriodStartDate?: string;
  currentPeriodEndDate?: string;
  nextTransactionDate?: string;
  canceledAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

/**
 * Shared helper for fetching subscriptions from transactions.
 * Both TUI and CLI list command use this to avoid N+1 queries.
 */
interface FetchSubscriptionsResult {
  subscriptions: Subscription[];
  hasMore: boolean;
}

interface FetchSubscriptionsOptions {
  targetCount: number;
  maxTransactionPages?: number;
  statusFilter?: string;
  onProgress?: (message: string) => void;
}

async function fetchSubscriptionsFromTransactions(
  options: FetchSubscriptionsOptions
): Promise<FetchSubscriptionsResult> {
  const client = getClient();
  const {
    targetCount,
    maxTransactionPages = 20,
    statusFilter,
    onProgress,
  } = options;

  // Phase 1: Collect unique subscription IDs from transactions
  const subscriptionIds = new Set<string>();
  let transactionPage = 1;
  let noMoreTransactions = false;

  onProgress?.('Scanning transactions for subscriptions...');

  while (subscriptionIds.size < targetCount && transactionPage <= maxTransactionPages) {
    const transactions = await client.transactions.search(
      undefined,
      undefined,
      undefined,
      transactionPage,
      50
    );
    const items = (transactions as { items?: Array<{ subscription?: string }> }).items || [];

    if (items.length === 0) {
      noMoreTransactions = true;
      break;
    }

    for (const txn of items) {
      if (txn.subscription) {
        subscriptionIds.add(txn.subscription);
      }
    }

    transactionPage++;
  }

  if (subscriptionIds.size === 0) {
    return { subscriptions: [], hasMore: false };
  }

  // Phase 2: Batch fetch subscriptions in parallel
  onProgress?.(`Fetching ${subscriptionIds.size} subscription(s)...`);

  const subscriptionIdArray = Array.from(subscriptionIds);
  const allSubscriptions: Subscription[] = [];

  const batchSize = 10;
  for (let i = 0; i < subscriptionIdArray.length; i += batchSize) {
    const batch = subscriptionIdArray.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(id => client.subscriptions.get(id))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allSubscriptions.push(result.value as unknown as Subscription);
      }
    }
  }

  // Phase 3: Apply status filter if specified
  let filteredSubscriptions = allSubscriptions;
  if (statusFilter) {
    filteredSubscriptions = allSubscriptions.filter(
      sub => sub.status.toLowerCase() === statusFilter
    );
  }

  return {
    subscriptions: filteredSubscriptions,
    hasMore: !noMoreTransactions,
  };
}

function formatSubscription(sub: Subscription, jsonFlag?: boolean): void {
  if (shouldOutputJson(jsonFlag)) {
    output.outputJson(sub);
    return;
  }

  const product = typeof sub.product === 'object' ? sub.product : null;
  const customer = typeof sub.customer === 'object' ? sub.customer : null;

  output.header('Subscription Details');
  output.newline();

  const data: Record<string, unknown> = {
    ID: sub.id,
    Status: formatStatus(sub.status),
    Mode: sub.mode,
    Customer: customer
      ? `${customer.email}${customer.name ? ` (${customer.name})` : ''}`
      : (sub.customer as string),
    'Customer ID': customer?.id || sub.customer,
    Product: product?.name || (sub.product as string),
    'Product ID': product?.id || sub.product,
  };

  if (product) {
    data['Price'] = output.formatCurrency(product.price, product.currency);
    if (product.billingPeriod) {
      data['Billing Period'] = product.billingPeriod;
    }
  }

  if (sub.currentPeriodStartDate) {
    data['Period Start'] = output.formatDate(sub.currentPeriodStartDate);
  }
  if (sub.currentPeriodEndDate) {
    data['Period End'] = output.formatDate(sub.currentPeriodEndDate);
  }
  if (sub.nextTransactionDate) {
    data['Next Billing'] = output.formatDate(sub.nextTransactionDate);
  }
  if (sub.canceledAt) {
    data['Canceled At'] = output.formatDate(sub.canceledAt);
  }

  data['Created'] = output.formatDate(sub.createdAt);
  data['Updated'] = output.formatDate(sub.updatedAt);

  output.outputKeyValue(data);
}

function getSubscriptionDetailLines(sub: Subscription): string[] {
  const product = typeof sub.product === 'object' ? sub.product : null;
  const customer = typeof sub.customer === 'object' ? sub.customer : null;
  const lines: string[] = [];
  const dl = output.detailLine;

  lines.push('');
  lines.push(dl('ID', sub.id));
  lines.push(dl('Status', formatStatus(sub.status)));
  lines.push(dl('Mode', sub.mode));
  lines.push(dl('Customer', customer ? `${customer.email}${customer.name ? ` (${customer.name})` : ''}` : (sub.customer as string)));
  lines.push(dl('Customer ID', String(customer?.id || sub.customer)));
  lines.push(dl('Product', String(product?.name || sub.product)));
  lines.push(dl('Product ID', String(product?.id || sub.product)));

  if (product) {
    lines.push(dl('Price', output.formatCurrency(product.price, product.currency)));
    if (product.billingPeriod) {
      lines.push(dl('Billing Period', product.billingPeriod));
    }
  }

  if (sub.currentPeriodStartDate) {
    lines.push(dl('Period Start', output.formatDate(sub.currentPeriodStartDate)));
  }
  if (sub.currentPeriodEndDate) {
    lines.push(dl('Period End', output.formatDate(sub.currentPeriodEndDate)));
  }
  if (sub.nextTransactionDate) {
    lines.push(dl('Next Billing', output.formatDate(sub.nextTransactionDate)));
  }
  if (sub.canceledAt) {
    lines.push(dl('Canceled At', output.formatDate(sub.canceledAt)));
  }

  lines.push(dl('Created', output.formatDate(sub.createdAt)));
  lines.push(dl('Updated', output.formatDate(sub.updatedAt)));

  return lines;
}

function getSubscriptionsTuiDescriptor(): TuiModuleDescriptor<Subscription> {
  return {
    name: 'Subscriptions',
    columns: [
      { header: 'ID', width: 24, value: (s) => s.id },
      {
        header: 'Customer',
        width: 28,
        value: (s) => (typeof s.customer === 'object' ? s.customer.email : String(s.customer)),
      },
      {
        header: 'Product',
        width: 20,
        value: (s) => (typeof s.product === 'object' ? s.product.name : String(s.product)),
      },
      { header: 'Status', width: 12, value: (s) => formatStatus(s.status) },
      {
        header: 'Next Billing',
        width: 'auto',
        value: (s) => (s.nextTransactionDate ? output.formatDate(s.nextTransactionDate) : '-'),
      },
    ],
    fetchPage: (() => {
      // Cache subscriptions to avoid re-fetching on pagination
      let cachedSubscriptions: Subscription[] = [];
      let hasMorePages = true;

      return async (page: number, pageSize: number) => {
        // On page 1 (or refresh), fetch fresh data using shared helper
        if (page === 1) {
          const result = await fetchSubscriptionsFromTransactions({
            targetCount: 200, // Fetch enough for TUI browsing
            maxTransactionPages: 20,
          });
          cachedSubscriptions = result.subscriptions;
          hasMorePages = result.hasMore;
        }

        // Calculate pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageItems = cachedSubscriptions.slice(startIndex, endIndex);

        // hasMore should be true only if there are actually more items to show:
        // - Either more items exist in cache beyond current page
        // - Or we're on page 1 and API indicated more pages exist (for initial load indicator)
        // Don't use hasMorePages on pages > 1 as we only slice from cache at that point
        const hasMoreInCache = cachedSubscriptions.length > endIndex;
        const mightHaveMoreFromApi = page === 1 && hasMorePages && pageItems.length > 0;

        return {
          items: pageItems,
          hasMore: hasMoreInCache || mightHaveMoreFromApi,
        };
      };
    })(),
    getId: (s) => s.id,
    renderDetail: (s) => getSubscriptionDetailLines(s),
    commands: [
      {
        name: 'cancel',
        description: 'Cancel subscription',
        requiresSelection: true,
        destructive: true,
        execute: async (item) => {
          const client = getClient();
          await client.subscriptions.cancel(item!.id, { mode: 'immediate' });
          return { success: true, message: 'Subscription canceled', refreshList: true };
        },
      },
      {
        name: 'pause',
        description: 'Pause subscription',
        requiresSelection: true,
        destructive: true,
        execute: async (item) => {
          const client = getClient();
          await client.subscriptions.pause(item!.id);
          return { success: true, message: 'Subscription paused', refreshList: true };
        },
      },
      {
        name: 'resume',
        description: 'Resume subscription',
        requiresSelection: true,
        execute: async (item) => {
          const client = getClient();
          await client.subscriptions.resume(item!.id);
          return { success: true, message: 'Subscription resumed', refreshList: true };
        },
      },
    ],
    searchFilter: (s, query) => {
      const q = query.toLowerCase();
      const customer = typeof s.customer === 'object' ? s.customer.email : String(s.customer);
      const product = typeof s.product === 'object' ? s.product.name : String(s.product);
      return (
        s.id.toLowerCase().includes(q) ||
        customer.toLowerCase().includes(q) ||
        product.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    },
  };
}

export function createSubscriptionsCommand(): Command {
  const command = new Command('subscriptions')
    .description('Manage subscriptions')
    .alias('subs')
    .action(async () => {
      const { launchInteractiveMode } = await import('../tui');
      const descriptor = getSubscriptionsTuiDescriptor();
      await launchInteractiveMode(descriptor);
    });

  // Get subscription
  command
    .command('get <id>')
    .description('Get subscription details by ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const spinner = ora('Fetching subscription...').start();

      try {
        const client = getClient();
        const result = (await client.subscriptions.get(id)) as unknown as Subscription;

        spinner.stop();
        formatSubscription(result, options.json);
      } catch (error) {
        spinner.fail('Failed to fetch subscription');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Cancel subscription
  command
    .command('cancel <id>')
    .description('Cancel a subscription')
    .option('--mode <mode>', 'Cancellation mode: immediate or scheduled', 'immediate')
    .option('--on-execute <action>', 'Action on scheduled cancel: cancel or pause')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: { mode?: string; onExecute?: string; json?: boolean }) => {
      const spinner = ora('Canceling subscription...').start();

      try {
        const client = getClient();

        // Cast to the expected SDK types
        const params: { mode?: 'immediate' | 'scheduled'; onExecute?: 'cancel' | 'pause' } = {};
        if (options.mode === 'immediate' || options.mode === 'scheduled') {
          params.mode = options.mode;
        }
        if (options.onExecute === 'cancel' || options.onExecute === 'pause') {
          params.onExecute = options.onExecute;
        }

        const result = (await client.subscriptions.cancel(id, params)) as unknown as Subscription;

        spinner.succeed('Subscription canceled');
        if (!shouldOutputJson(options.json)) {
          output.newline();
        }
        formatSubscription(result, options.json);
      } catch (error) {
        spinner.fail('Failed to cancel subscription');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Pause subscription
  command
    .command('pause <id>')
    .description('Pause a subscription')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const spinner = ora('Pausing subscription...').start();

      try {
        const client = getClient();
        const result = (await client.subscriptions.pause(id)) as unknown as Subscription;

        spinner.succeed('Subscription paused');
        if (!shouldOutputJson(options.json)) {
          output.newline();
        }
        formatSubscription(result, options.json);
      } catch (error) {
        spinner.fail('Failed to pause subscription');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Resume subscription
  command
    .command('resume <id>')
    .description('Resume a paused subscription')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const spinner = ora('Resuming subscription...').start();

      try {
        const client = getClient();
        const result = (await client.subscriptions.resume(id)) as unknown as Subscription;

        spinner.succeed('Subscription resumed');
        if (!shouldOutputJson(options.json)) {
          output.newline();
        }
        formatSubscription(result, options.json);
      } catch (error) {
        spinner.fail('Failed to resume subscription');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // List subscriptions (derived from transactions with subscription field)
  command
    .command('list')
    .description('List all subscriptions')
    .option('--page <number>', 'Page number', '1')
    .option('--limit <number>', 'Results per page', '10')
    .option('--status <status>', 'Filter by status (active, paused, canceled, scheduled_cancel)')
    .option('--json', 'Output as JSON')
    .action(async (options: { page?: string; limit?: string; status?: string; json?: boolean }) => {
      const spinner = ora('Fetching subscriptions...').start();

      try {
        const pageSize = Math.min(parseInt(options.limit || '10', 10), 50);
        const statusFilter = options.status?.toLowerCase();
        const requestedPage = parseInt(options.page || '1', 10);

        // Use shared helper to fetch subscriptions (avoids N+1 queries)
        const targetCount = requestedPage * pageSize + 50; // Fetch extra to account for filtering
        const result = await fetchSubscriptionsFromTransactions({
          targetCount,
          statusFilter,
          onProgress: (msg) => { spinner.text = msg; },
        });

        if (result.subscriptions.length === 0) {
          spinner.stop();
          output.info('No subscriptions found');
          return;
        }

        // Apply pagination
        const startIndex = (requestedPage - 1) * pageSize;
        const subscriptions = result.subscriptions.slice(startIndex, startIndex + pageSize);

        spinner.stop();

        if (shouldOutputJson(options.json)) {
          output.outputJson({
            items: subscriptions,
            total: result.subscriptions.length,
            page: requestedPage,
            pageSize: pageSize,
            note: 'Subscriptions derived from transaction history',
          });
          return;
        }

        if (subscriptions.length === 0) {
          output.info('No subscriptions found');
          return;
        }

        // Format as table
        const headers = ['ID', 'Customer', 'Product', 'Status', 'Next Billing'];
        const rows = subscriptions.map((sub) => {
          const customer = typeof sub.customer === 'object' ? sub.customer.email : sub.customer;
          const product = typeof sub.product === 'object' ? sub.product.name : sub.product;
          return [
            sub.id,
            customer,
            product,
            formatStatus(sub.status),
            sub.nextTransactionDate ? output.formatDate(sub.nextTransactionDate) : '-',
          ];
        });

        output.outputTable(headers, rows);
        output.newline();
        output.info(`Showing ${subscriptions.length} of ${result.subscriptions.length} subscription(s) (page ${requestedPage})`);
        if (statusFilter) {
          output.info(`Filtered by status: ${statusFilter}`);
        }
      } catch (error) {
        spinner.fail('Failed to fetch subscriptions');
        output.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return command;
}
