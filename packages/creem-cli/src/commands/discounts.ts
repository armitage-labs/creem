import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient, getBaseUrl } from '../lib/api';
import { shouldOutputJson, getConfigValue } from '../lib/config';
import * as output from '../utils/output';

interface Discount {
  id: string;
  mode: string;
  object: string;
  status: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  amount?: number;
  currency?: string;
  percentage?: number;
  expiryDate?: string;
  maxRedemptions?: number;
  duration?: string;
  durationInMonths?: number;
  appliesToProducts?: string[];
  redeemCount?: number;
}

interface DiscountListResponse {
  items: Discount[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    nextPage?: number;
  };
}

/**
 * Formats discount type with amount for display
 */
function formatDiscountValue(discount: Discount): string {
  if (discount.type === 'percentage') {
    return `${discount.percentage || discount.amount}%`;
  } else {
    const amount = discount.amount || 0;
    const currency = discount.currency || 'USD';
    return output.formatCurrency(amount, currency);
  }
}

/**
 * Formats discount status with color
 */
function formatStatus(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return chalk.green(status);
    case 'expired':
      return chalk.red(status);
    case 'draft':
      return chalk.dim(status);
    case 'scheduled':
      return chalk.yellow(status);
    default:
      return status || '-';
  }
}

/**
 * Formats duration for display
 */
function formatDuration(discount: Discount): string {
  if (!discount.duration) return '-';
  
  switch (discount.duration) {
    case 'forever':
      return 'Forever';
    case 'once':
      return 'Once';
    case 'repeating':
      return `${discount.durationInMonths || 0} months`;
    default:
      return discount.duration;
  }
}

export function createDiscountsCommand(): Command {
  const command = new Command('discounts')
    .description('Manage discounts')
    .action(() => {
      command.help();
    });

  // List discounts
  command
    .command('list')
    .description('List all discounts')
    .option('--json', 'Output as JSON')
    .option('--page <number>', 'Page number', '1')
    .option('--limit <number>', 'Number of results per page', '20')
    .action(async (options: { json?: boolean; page: string; limit: string }) => {
      const spinner = ora('Fetching discounts...').start();

      try {
        // Note: The SDK doesn't have a list method for discounts yet,
        // so we make a direct API call to the internal endpoint
        const apiKey = getConfigValue('api_key');
        if (!apiKey) {
          spinner.stop();
          output.error('Not authenticated. Run `creem login` first.');
          process.exit(1);
        }
        
        const baseUrl = getBaseUrl();
        
        const url = new URL(`${baseUrl}/v1/discounts/list`);
        url.searchParams.set('page', options.page);
        url.searchParams.set('limit', options.limit);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // If endpoint doesn't exist, show helpful message
          if (response.status === 404) {
            spinner.stop();
            output.newline();
            output.info('Discount list endpoint is not available via API.');
            output.dim('View your discounts at: https://creem.io/dashboard/discounts');
            output.newline();
            output.dim('You can retrieve a specific discount using:');
            console.log(chalk.cyan('  creem discounts get <discount-id>'));
            console.log(chalk.cyan('  creem discounts get --code <discount-code>'));
            return;
          }
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as DiscountListResponse;
        spinner.stop();

        const { items, pagination } = data;

        if (shouldOutputJson(options.json)) {
          output.outputJson(data);
          return;
        }

        output.newline();

        if (items.length === 0) {
          output.info('No discounts found.');
          output.dim('Create a discount with: creem discounts create');
          return;
        }

        output.outputTable(
          ['ID', 'Code', 'Value', 'Duration', 'Status'],
          items.map((d) => [
            d.id,
            d.code,
            formatDiscountValue(d),
            formatDuration(d),
            formatStatus(d.status),
          ])
        );

        output.newline();
        output.dim(
          `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalRecords} total)`
        );
        output.newline();
      } catch (error) {
        spinner.stop();
        
        // Check if it's a network/API error that suggests the endpoint doesn't exist
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
          output.newline();
          output.info('Discount list endpoint is not available via API.');
          output.dim('View your discounts at: https://creem.io/dashboard/discounts');
          output.newline();
          output.dim('You can retrieve a specific discount using:');
          console.log(chalk.cyan('  creem discounts get <discount-id>'));
          console.log(chalk.cyan('  creem discounts get --code <discount-code>'));
          return;
        }
        
        output.error(errorMsg);
        process.exit(1);
      }
    });

  // Get discount by ID or code
  command
    .command('get [discount-id]')
    .description('Get discount details by ID or code')
    .option('--code <code>', 'Get discount by code instead of ID')
    .option('--json', 'Output as JSON')
    .action(async (discountId: string | undefined, options: { code?: string; json?: boolean }) => {
      if (!discountId && !options.code) {
        output.error('Please provide a discount ID or use --code <code>');
        process.exit(1);
      }

      if (discountId && options.code) {
        output.error('Please provide either a discount ID or --code, not both');
        process.exit(1);
      }

      const spinner = ora('Fetching discount...').start();

      try {
        const client = getClient();
        const discount = (await client.discounts.get(
          discountId || undefined,
          options.code || undefined
        )) as unknown as Discount;

        spinner.stop();

        if (shouldOutputJson(options.json)) {
          output.outputJson(discount);
          return;
        }

        output.newline();
        output.header(discount.name);
        output.newline();

        output.outputKeyValue({
          ID: discount.id,
          Code: discount.code,
          Status: formatStatus(discount.status),
          Type: discount.type,
          Value: formatDiscountValue(discount),
          Duration: formatDuration(discount),
          Mode: discount.mode,
          'Max Redemptions': discount.maxRedemptions?.toString() || 'Unlimited',
          'Times Redeemed': discount.redeemCount?.toString() || '0',
          'Expiry Date': discount.expiryDate ? output.formatDate(discount.expiryDate) : 'Never',
        });

        if (discount.appliesToProducts && discount.appliesToProducts.length > 0) {
          output.newline();
          output.dim('Applies to Products:');
          discount.appliesToProducts.forEach((productId) => {
            console.log(`  • ${productId}`);
          });
        }

        output.newline();
      } catch (error) {
        spinner.stop();
        output.error(error instanceof Error ? error.message : 'Failed to fetch discount');
        process.exit(1);
      }
    });

  // Create discount
  command
    .command('create')
    .description('Create a new discount')
    .requiredOption('--name <name>', 'Discount name')
    .option('--code <code>', 'Discount code (auto-generated if not provided)')
    .requiredOption('--type <type>', 'Discount type: "percentage" or "fixed"')
    .option('--amount <cents>', 'Discount amount in cents (required for fixed type)')
    .option('--percentage <number>', 'Discount percentage 1-100 (required for percentage type)')
    .option('--currency <code>', 'Currency code for fixed discounts (default: USD)')
    .option('--expires <date>', 'Expiry date (ISO format, e.g., 2025-12-31)')
    .option('--max-redemptions <number>', 'Maximum number of times the discount can be used')
    .requiredOption('--duration <type>', 'Duration type: "once", "forever", or "repeating"')
    .option('--duration-months <number>', 'Number of months for repeating duration')
    .requiredOption('--products <ids>', 'Comma-separated list of product IDs this discount applies to')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `
${chalk.dim('Required fields:')}
  --name               Discount name
  --type               "percentage" or "fixed"
  --duration           "once", "forever", or "repeating"
  --products           Comma-separated product IDs

${chalk.dim('For percentage discounts:')}
  --percentage         Discount percentage (1-100)

${chalk.dim('For fixed discounts:')}
  --amount             Discount amount in cents
  --currency           Currency code (default: USD)

${chalk.dim('Duration types:')}
  once                 Discount applies to the first payment only
  forever              Discount applies to all payments
  repeating            Discount applies for a set number of months

${chalk.dim('Examples:')}
  ${chalk.cyan('creem discounts create --name "Summer Sale" --type percentage --percentage 20 --duration once --products prod_abc123')}
  ${chalk.cyan('creem discounts create --name "Launch Discount" --code LAUNCH50 --type percentage --percentage 50 --duration forever --products prod_abc123,prod_def456')}
  ${chalk.cyan('creem discounts create --name "$10 Off" --type fixed --amount 1000 --currency USD --duration once --products prod_abc123')}
`
    )
    .action(
      async (options: {
        name: string;
        code?: string;
        type: string;
        amount?: string;
        percentage?: string;
        currency?: string;
        expires?: string;
        maxRedemptions?: string;
        duration: string;
        durationMonths?: string;
        products: string;
        json?: boolean;
      }) => {
        // Validate type
        if (!['percentage', 'fixed'].includes(options.type)) {
          output.error('Type must be "percentage" or "fixed"');
          process.exit(1);
        }

        // Validate duration
        if (!['once', 'forever', 'repeating'].includes(options.duration)) {
          output.error('Duration must be "once", "forever", or "repeating"');
          process.exit(1);
        }

        // Validate percentage type requirements
        if (options.type === 'percentage') {
          if (!options.percentage) {
            output.error('--percentage is required when type is "percentage"');
            process.exit(1);
          }
          const pct = parseInt(options.percentage, 10);
          if (isNaN(pct) || pct < 1 || pct > 100) {
            output.error('Percentage must be between 1 and 100');
            process.exit(1);
          }
          if (options.amount) {
            output.error('--amount should not be used with percentage type');
            process.exit(1);
          }
        }

        // Validate fixed type requirements
        if (options.type === 'fixed') {
          if (!options.amount) {
            output.error('--amount is required when type is "fixed"');
            process.exit(1);
          }
          const amt = parseInt(options.amount, 10);
          if (isNaN(amt) || amt <= 0) {
            output.error('Amount must be a positive number');
            process.exit(1);
          }
          if (options.percentage) {
            output.error('--percentage should not be used with fixed type');
            process.exit(1);
          }
        }

        // Validate repeating duration requires months
        if (options.duration === 'repeating' && !options.durationMonths) {
          output.error('--duration-months is required when duration is "repeating"');
          process.exit(1);
        }

        // Parse products
        const productIds = options.products.split(',').map((id) => id.trim()).filter(Boolean);
        if (productIds.length === 0) {
          output.error('At least one product ID is required');
          process.exit(1);
        }

        const spinner = ora('Creating discount...').start();

        try {
          const client = getClient();

          const params: {
            name: string;
            code?: string;
            type: 'percentage' | 'fixed';
            amount?: number;
            currency?: string;
            percentage?: number;
            expiryDate?: Date;
            maxRedemptions?: number;
            duration: 'once' | 'forever' | 'repeating';
            durationInMonths?: number;
            appliesToProducts: string[];
          } = {
            name: options.name,
            type: options.type as 'percentage' | 'fixed',
            duration: options.duration as 'once' | 'forever' | 'repeating',
            appliesToProducts: productIds,
          };

          if (options.code) {
            params.code = options.code;
          }

          if (options.type === 'percentage' && options.percentage) {
            params.percentage = parseInt(options.percentage, 10);
          }

          if (options.type === 'fixed' && options.amount) {
            params.amount = parseInt(options.amount, 10);
            params.currency = (options.currency || 'USD').toUpperCase();
          }

          if (options.expires) {
            params.expiryDate = new Date(options.expires);
          }

          if (options.maxRedemptions) {
            params.maxRedemptions = parseInt(options.maxRedemptions, 10);
          }

          if (options.durationMonths) {
            params.durationInMonths = parseInt(options.durationMonths, 10);
          }

          const discount = (await client.discounts.create(params)) as unknown as Discount;

          spinner.stop();

          if (shouldOutputJson(options.json)) {
            output.outputJson(discount);
            return;
          }

          output.newline();
          output.success('Discount created!');
          output.newline();

          output.outputKeyValue({
            ID: discount.id,
            Name: discount.name,
            Code: discount.code,
            Status: formatStatus(discount.status),
            Type: discount.type,
            Value: formatDiscountValue(discount),
            Duration: formatDuration(discount),
            Mode: discount.mode,
          });

          output.newline();
          output.dim('Share this discount code with customers:');
          console.log(chalk.cyan.bold(`  ${discount.code}`));
          output.newline();
        } catch (error) {
          spinner.fail('Failed to create discount');
          output.error(error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }
    );

  // Delete discount
  command
    .command('delete <discount-id>')
    .description('Delete a discount')
    .option('--json', 'Output as JSON')
    .action(async (discountId: string, options: { json?: boolean }) => {
      const spinner = ora('Deleting discount...').start();

      try {
        const client = getClient();
        const discount = (await client.discounts.delete(discountId)) as unknown as Discount;

        spinner.stop();

        if (shouldOutputJson(options.json)) {
          output.outputJson(discount);
          return;
        }

        output.newline();
        output.success(`Discount "${discount.name}" (${discount.code}) deleted`);
        output.newline();
      } catch (error) {
        spinner.stop();
        output.error(error instanceof Error ? error.message : 'Failed to delete discount');
        process.exit(1);
      }
    });

  return command;
}
