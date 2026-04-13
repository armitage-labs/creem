import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { getClient } from "../lib/api";
import { shouldOutputJson } from "../lib/config";
import * as output from "../utils/output";
import type { TuiModuleDescriptor } from "../tui";

interface ProductFeature {
  id: string;
  type: string;
  description: string;
}

interface Product {
  id: string;
  mode: string;
  object: string;
  name: string;
  description?: string;
  imageUrl?: string;
  features?: ProductFeature[];
  price: number;
  currency: string;
  billingType: string;
  billingPeriod?: string;
  status: string;
  taxMode: string;
  taxCategory: string;
  productUrl?: string;
  defaultSuccessUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductListResponse {
  items: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    nextPage?: number;
  };
}

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
  lines.push(
    dl("Price", output.formatCurrency(product.price, product.currency)),
  );
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

function getProductsTuiDescriptor(): TuiModuleDescriptor<Product> {
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
      const client = getClient();
      const response = (await client.products.search(
        page,
        pageSize,
      )) as unknown as ProductListResponse;
      const { items, pagination } = response;
      return {
        items,
        hasMore: pagination.nextPage !== undefined,
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

export function createProductsCommand(): Command {
  const command = new Command("products")
    .description("Manage products")
    .action(async () => {
      const { launchInteractiveMode } = await import("../tui");
      const descriptor = getProductsTuiDescriptor();
      await launchInteractiveMode(descriptor);
    });

  // Create product
  command
    .command("create")
    .description("Create a new product")
    .requiredOption("--name <name>", "Product name")
    .requiredOption("--description <text>", "Product description")
    .requiredOption(
      "--price <cents>",
      "Price in cents (e.g. 1000 = $10.00, minimum 100)",
    )
    .requiredOption(
      "--currency <code>",
      "Three-letter ISO currency code (USD, EUR)",
    )
    .requiredOption(
      "--billing-type <type>",
      'Billing method: "recurring" or "onetime"',
    )
    .option(
      "--billing-period <period>",
      "Billing period (required for recurring): every-month, every-three-months, every-six-months, every-year",
    )
    .option(
      "--tax-mode <mode>",
      'Tax calculation mode: "inclusive" or "exclusive"',
    )
    .option(
      "--tax-category <category>",
      'Tax category: "saas", "digital-goods-service", or "ebooks"',
    )
    .option("--image-url <url>", "Product image URL")
    .option("--success-url <url>", "Redirect URL after successful payment")
    .option("--abandoned-cart-recovery", "Enable abandoned cart recovery")
    .option("--json", "Output as JSON")
    .addHelpText(
      "after",
      `
${chalk.dim("Required fields:")}
  --name               Product name
  --description        Product description
  --price              Price in cents (minimum 100 = $1.00)
  --currency           USD or EUR
  --billing-type       "recurring" or "onetime"

${chalk.dim('Billing periods (required when --billing-type is "recurring"):')}
  every-month          Monthly billing cycle
  every-three-months   Quarterly billing cycle
  every-six-months     Semi-annual billing cycle
  every-year           Annual billing cycle

${chalk.dim("Tax modes:")}
  inclusive             Tax is included in the price
  exclusive             Tax is added on top of the price

${chalk.dim("Tax categories:")}
  saas                  Software as a Service
  digital-goods-service Digital goods or services
  ebooks                E-books

${chalk.dim("Examples:")}
  ${chalk.cyan('creem products create --name "Pro Plan" --description "Full access" --price 2999 --currency USD --billing-type recurring --billing-period every-month')}
  ${chalk.cyan('creem products create --name "Template Pack" --description "50 premium templates" --price 4999 --currency USD --billing-type onetime --tax-mode exclusive --tax-category digital-goods-service')}
`,
    )
    .action(
      async (options: {
        name: string;
        description: string;
        price: string;
        currency: string;
        billingType: string;
        billingPeriod?: string;
        taxMode?: string;
        taxCategory?: string;
        imageUrl?: string;
        successUrl?: string;
        abandonedCartRecovery?: boolean;
        json?: boolean;
      }) => {
        // Validate price
        const price = parseInt(options.price, 10);
        if (isNaN(price) || price < 100) {
          output.error("Price must be a number of at least 100 cents ($1.00).");
          process.exit(1);
        }

        // Validate billing type
        const validBillingTypes = ["recurring", "onetime"];
        if (!validBillingTypes.includes(options.billingType)) {
          output.error(
            `Invalid billing type "${options.billingType}". Must be "recurring" or "onetime".`,
          );
          process.exit(1);
        }

        // Validate billing period is provided for recurring
        const validBillingPeriods = [
          "every-month",
          "every-three-months",
          "every-six-months",
          "every-year",
        ];
        if (options.billingType === "recurring" && !options.billingPeriod) {
          output.error(
            "Billing period is required for recurring products. Use --billing-period.",
          );
          process.exit(1);
        }
        if (
          options.billingPeriod &&
          !validBillingPeriods.includes(options.billingPeriod)
        ) {
          output.error(
            `Invalid billing period "${options.billingPeriod}". Must be one of: ${validBillingPeriods.join(", ")}.`,
          );
          process.exit(1);
        }

        // Validate tax mode
        if (
          options.taxMode &&
          !["inclusive", "exclusive"].includes(options.taxMode)
        ) {
          output.error(
            `Invalid tax mode "${options.taxMode}". Must be "inclusive" or "exclusive".`,
          );
          process.exit(1);
        }

        // Validate tax category
        const validTaxCategories = ["saas", "digital-goods-service", "ebooks"];
        if (
          options.taxCategory &&
          !validTaxCategories.includes(options.taxCategory)
        ) {
          output.error(
            `Invalid tax category "${options.taxCategory}". Must be one of: ${validTaxCategories.join(", ")}.`,
          );
          process.exit(1);
        }

        // Validate currency
        const currency = options.currency.toUpperCase();
        if (!["USD", "EUR"].includes(currency)) {
          output.error(
            `Invalid currency "${options.currency}". Supported currencies: USD, EUR.`,
          );
          process.exit(1);
        }

        const spinner = ora("Creating product...").start();

        try {
          const client = getClient();

          const params: {
            name: string;
            description: string;
            price: number;
            currency: string;
            billingType: string;
            billingPeriod?: string;
            taxMode?: string;
            taxCategory?: string;
            imageUrl?: string;
            defaultSuccessUrl?: string;
            abandonedCartRecoveryEnabled?: boolean;
          } = {
            name: options.name,
            description: options.description,
            price,
            currency,
            billingType: options.billingType,
          };

          if (options.billingPeriod) {
            params.billingPeriod = options.billingPeriod;
          }
          if (options.taxMode) {
            params.taxMode = options.taxMode;
          }
          if (options.taxCategory) {
            params.taxCategory = options.taxCategory;
          }
          if (options.imageUrl) {
            params.imageUrl = options.imageUrl;
          }
          if (options.successUrl) {
            params.defaultSuccessUrl = options.successUrl;
          }
          if (options.abandonedCartRecovery) {
            params.abandonedCartRecoveryEnabled = true;
          }

          const product = (await client.products.create(
            params as Parameters<typeof client.products.create>[0],
          )) as unknown as Product;

          spinner.stop();

          if (shouldOutputJson(options.json)) {
            output.outputJson(product);
            return;
          }

          output.newline();
          output.success("Product created!");
          output.newline();

          output.outputKeyValue({
            ID: product.id,
            Name: product.name,
            Status: formatStatus(product.status),
            Price: output.formatCurrency(product.price, product.currency),
            Currency: product.currency.toUpperCase(),
            Billing: formatBilling(product),
            "Tax Mode": product.taxMode,
            "Tax Category": product.taxCategory,
            Mode: product.mode,
            Created: output.formatDate(product.createdAt),
          });

          if (product.description) {
            output.newline();
            output.dim("Description:");
            console.log(product.description);
          }

          if (product.productUrl) {
            output.newline();
            output.info("Product URL:");
            console.log(chalk.cyan.bold(product.productUrl));
          }

          output.newline();
        } catch (error) {
          spinner.fail("Failed to create product");
          output.error(
            error instanceof Error ? error.message : "Unknown error",
          );
          process.exit(1);
        }
      },
    );

  // List products
  command
    .command("list")
    .description("List all products")
    .option("--json", "Output as JSON")
    .option("--page <number>", "Page number", "1")
    .option("--limit <number>", "Number of results per page", "20")
    .action(
      async (options: { json?: boolean; page: string; limit: string }) => {
        const spinner = ora("Fetching products...").start();

        try {
          const client = getClient();
          const response = (await client.products.search(
            parseInt(options.page, 10),
            parseInt(options.limit, 10),
          )) as unknown as ProductListResponse;

          spinner.stop();

          const { items, pagination } = response;

          if (shouldOutputJson(options.json)) {
            output.outputJson(response);
            return;
          }

          output.newline();

          if (items.length === 0) {
            output.info("No products found.");
            output.dim(
              "Create a product at: https://creem.io/dashboard/products",
            );
            return;
          }

          output.outputTable(
            ["ID", "Name", "Price", "Billing", "Status"],
            items.map((p) => [
              p.id,
              output.truncate(p.name, 30),
              output.formatCurrency(p.price, p.currency),
              formatBilling(p),
              formatStatus(p.status),
            ]),
          );

          output.newline();
          output.dim(
            `Page ${pagination.currentPage} of ${pagination.totalPages} (${pagination.totalRecords} total)`,
          );
          output.newline();
        } catch (error) {
          spinner.stop();
          output.error(
            error instanceof Error ? error.message : "Failed to fetch products",
          );
          process.exit(1);
        }
      },
    );

  // Get product by ID
  command
    .command("get <product-id>")
    .description("Get product details")
    .option("--json", "Output as JSON")
    .action(async (productId: string, options: { json?: boolean }) => {
      const spinner = ora("Fetching product...").start();

      try {
        const client = getClient();
        const product = (await client.products.get(
          productId,
        )) as unknown as Product;

        spinner.stop();

        if (shouldOutputJson(options.json)) {
          output.outputJson(product);
          return;
        }

        output.newline();
        output.header(product.name);
        output.newline();

        output.outputKeyValue({
          ID: product.id,
          Status: formatStatus(product.status),
          Price: output.formatCurrency(product.price, product.currency),
          Currency: product.currency.toUpperCase(),
          Billing: formatBilling(product),
          "Tax Mode": product.taxMode,
          "Tax Category": product.taxCategory,
          Mode: product.mode,
          Created: output.formatDate(product.createdAt),
          Updated: output.formatDate(product.updatedAt),
        });

        if (product.description) {
          output.newline();
          output.dim("Description:");
          console.log(product.description);
        }

        if (product.productUrl) {
          output.newline();
          output.dim("Product URL:");
          console.log(chalk.cyan(product.productUrl));
        }

        if (product.features && product.features.length > 0) {
          output.newline();
          output.dim("Features:");
          product.features.forEach((f) => {
            console.log(`  • ${f.type}: ${f.description}`);
          });
        }

        output.newline();
      } catch (error) {
        spinner.stop();
        output.error(
          error instanceof Error ? error.message : "Failed to fetch product",
        );
        process.exit(1);
      }
    });

  return command;
}
