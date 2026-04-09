import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../lib/api';
import { shouldOutputJson } from '../lib/config';
import * as output from '../utils/output';

interface Checkout {
  id: string;
  mode: string;
  object: string;
  product?: string;
  customer?: string;
  status: string;
  checkoutUrl: string;
  successUrl?: string;
  metadata?: Record<string, string>;
  expiresAt?: string;
  createdAt?: string;
}

/**
 * Formats checkout status with color
 */
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
      return chalk.green(status);
    case 'expired':
      return chalk.red(status);
    case 'pending':
    case 'open':
      return chalk.yellow(status);
    default:
      return status || '-';
  }
}

export function createCheckoutsCommand(): Command {
  const command = new Command('checkouts').description('Manage checkout sessions');

  // Create checkout
  command
    .command('create')
    .description('Create a new checkout session')
    .requiredOption('--product <id>', 'Product ID')
    .option('--customer <id>', 'Customer ID (optional)')
    .option('--success-url <url>', 'Success redirect URL')
    .option('--discount <code>', 'Discount code')
    .option('--request-id <id>', 'Idempotency request ID')
    .option('--json', 'Output as JSON')
    .action(
      async (options: {
        product: string;
        customer?: string;
        successUrl?: string;
        discount?: string;
        requestId?: string;
        json?: boolean;
      }) => {
        const spinner = ora('Creating checkout session...').start();

        try {
          const client = getClient();

          // Build request params
          const params: {
            productId: string;
            customer?: { id?: string };
            successUrl?: string;
            discountCode?: string;
            requestId?: string;
          } = {
            productId: options.product,
          };

          if (options.customer) {
            params.customer = { id: options.customer };
          }
          if (options.successUrl) {
            params.successUrl = options.successUrl;
          }
          if (options.discount) {
            params.discountCode = options.discount;
          }
          if (options.requestId) {
            params.requestId = options.requestId;
          }

          const checkout = (await client.checkouts.create(params)) as unknown as Checkout;

          spinner.stop();

          if (shouldOutputJson(options.json)) {
            output.outputJson(checkout);
            return;
          }

          output.newline();
          output.success('Checkout session created!');
          output.newline();

          output.outputKeyValue({
            ID: checkout.id,
            Status: formatStatus(checkout.status),
            'Product ID': checkout.product || '-',
            'Customer ID': checkout.customer || '-',
            Mode: checkout.mode,
            Created: checkout.createdAt ? output.formatDate(checkout.createdAt) : 'N/A',
          });

          output.newline();
          output.info('Checkout URL:');
          console.log(chalk.cyan.bold(checkout.checkoutUrl));
          output.newline();

          output.dim('Share this URL with your customer to complete payment.');
          output.newline();
        } catch (error) {
          spinner.stop();
          output.error(error instanceof Error ? error.message : 'Failed to create checkout');
          process.exit(1);
        }
      }
    );

  // Get checkout by ID
  command
    .command('get <checkout-id>')
    .description('Get checkout session details')
    .option('--json', 'Output as JSON')
    .action(async (checkoutId: string, options: { json?: boolean }) => {
      const spinner = ora('Fetching checkout...').start();

      try {
        const client = getClient();
        const checkout = (await client.checkouts.retrieve(checkoutId)) as unknown as Checkout;

        spinner.stop();

        if (shouldOutputJson(options.json)) {
          output.outputJson(checkout);
          return;
        }

        output.newline();
        output.header('Checkout Session');
        output.newline();

        output.outputKeyValue({
          ID: checkout.id,
          Status: formatStatus(checkout.status),
          'Product ID': checkout.product || '-',
          'Customer ID': checkout.customer || '-',
          Mode: checkout.mode,
          Created: checkout.createdAt ? output.formatDate(checkout.createdAt) : 'N/A',
        });

        if (checkout.checkoutUrl) {
          output.newline();
          output.dim('Checkout URL:');
          console.log(chalk.cyan(checkout.checkoutUrl));
        }

        if (checkout.successUrl) {
          output.newline();
          output.dim('Success URL:');
          console.log(checkout.successUrl);
        }

        if (checkout.expiresAt) {
          output.newline();
          output.dim('Expires:');
          console.log(checkout.expiresAt ? output.formatDate(checkout.expiresAt) : 'N/A');
        }

        output.newline();
      } catch (error) {
        spinner.stop();
        output.error(error instanceof Error ? error.message : 'Failed to fetch checkout');
        process.exit(1);
      }
    });

  return command;
}
