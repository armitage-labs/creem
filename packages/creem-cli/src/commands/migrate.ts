import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { password, confirm } from '@inquirer/prompts';
import { getClient } from '../lib/api';
import * as output from '../utils/output';

// ============================================================================
// Types
// ============================================================================

interface LSProduct {
  id: string;
  attributes: {
    store_id: number;
    name: string;
    slug: string;
    description: string;
    status: string;
    status_formatted: string;
    thumb_url?: string;
    large_thumb_url?: string;
    price: number;
    price_formatted: string;
    from_price?: number;
    to_price?: number;
    pay_what_you_want: boolean;
    buy_now_url: string;
    created_at: string;
    updated_at: string;
  };
}

interface LSVariant {
  id: string;
  attributes: {
    product_id: number;
    name: string;
    slug: string;
    description?: string;
    price: number;
    is_subscription: boolean;
    interval?: string; // 'day' | 'week' | 'month' | 'year'
    interval_count?: number;
    has_free_trial: boolean;
    trial_interval?: string;
    trial_interval_count?: number;
    pay_what_you_want: boolean;
    min_price?: number;
    suggested_price?: number;
    has_license_keys: boolean;
    license_activation_limit?: number;
    is_license_limit_unlimited: boolean;
    license_length_value?: number;
    license_length_unit?: string;
    is_license_length_unlimited: boolean;
    sort: number;
    status: string;
    status_formatted: string;
    created_at: string;
    updated_at: string;
  };
}

interface LSDiscount {
  id: string;
  attributes: {
    store_id: number;
    name: string;
    code: string;
    amount: number;
    amount_type: 'percent' | 'fixed';
    is_limited_to_products: boolean;
    is_limited_redemptions: boolean;
    max_redemptions?: number;
    starts_at?: string;
    expires_at?: string;
    duration: 'once' | 'repeating' | 'forever';
    duration_in_months?: number;
    status: string;
    status_formatted: string;
    created_at: string;
    updated_at: string;
  };
}

interface LSCustomer {
  id: string;
  attributes: {
    store_id: number;
    name: string;
    email: string;
    status: string;
    city?: string;
    region?: string;
    country?: string;
    total_revenue_currency: number;
    mrr: number;
    status_formatted: string;
    country_formatted?: string;
    created_at: string;
    updated_at: string;
  };
}

interface LSFile {
  id: string;
  attributes: {
    variant_id: number;
    identifier: string;
    name: string;
    extension: string;
    download_url: string;
    size: number;
    size_formatted: string;
    version?: string;
    sort: number;
    status: string;
    created_at: string;
    updated_at: string;
  };
}

interface LSStore {
  id: string;
  attributes: {
    name: string;
    slug: string;
    domain: string;
    url: string;
    avatar_url: string;
    plan: string;
    country: string;
    country_nicename: string;
    currency: string; // Store's display currency (e.g., 'USD', 'EUR', 'GBP')
    currency_symbol: string;
    total_sales: number;
    total_revenue: number;
    thirty_day_sales: number;
    thirty_day_revenue: number;
    created_at: string;
    updated_at: string;
  };
}

interface LSApiResponse<T> {
  data: T[];
  meta: {
    page: {
      currentPage: number;
      from: number;
      lastPage: number;
      perPage: number;
      to: number;
      total: number;
    };
  };
  links: {
    first: string;
    last: string;
    next?: string;
    prev?: string;
  };
}

interface MigrationPlan {
  products: {
    lsProduct: LSProduct;
    lsVariant: LSVariant;
    creemProduct: {
      name: string;
      description: string;
      price: number;
      currency: 'USD' | 'EUR'; // Only USD and EUR are supported by CREEM
      billingType: string;
      billingPeriod?: string;
      taxCategory: string;
    };
    skipped?: boolean; // True if product can't be migrated (e.g., unsupported billing interval)
    skipReason?: string; // Reason why product was skipped
  }[];
  discounts: {
    lsDiscount: LSDiscount;
    creemDiscount: {
      name: string;
      code: string;
      type: 'percentage' | 'fixed';
      amount?: number; // For fixed type (in cents)
      percentage?: number; // For percentage type (1-100)
      currency?: string; // For fixed type
      duration: 'once' | 'forever' | 'repeating';
      durationInMonths?: number;
      maxRedemptions?: number;
      expiryDate?: Date;
    };
    skipped?: boolean;
    skipReason?: string;
  }[];
  customers: {
    lsCustomer: LSCustomer;
    creemCustomer: {
      email: string;
      name: string;
      billingAddress?: {
        city?: string;
        country?: string;
      };
    };
  }[];
  files: {
    lsFile: LSFile;
    variantId: string;
    productName: string;
  }[];
  summary: {
    totalProducts: number;
    totalDiscounts: number;
    totalCustomers: number;
    totalFiles: number;
    skippedProducts: number;
    skippedDiscounts: number;
  };
}

interface MigrationResult {
  success: boolean;
  created: {
    products: string[];
    discounts: string[];
    customers: string[];
    files: string[];
  };
  failed: {
    products: { name: string; error: string }[];
    discounts: { code: string; error: string }[];
    customers: { email: string; error: string }[];
    files: { name: string; error: string }[];
  };
  skipped: {
    products: { name: string; reason: string }[];
    discounts: { code: string; reason: string }[];
    customers: { email: string; reason: string }[];
  };
}

// ============================================================================
// Retry Utility
// ============================================================================

interface FailedEntity {
  type: 'product' | 'variant' | 'discount' | 'customer' | 'file' | 'store';
  label: string;
  error: string;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, and rate limits only
    if (
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch failed')
    ) {
      return true;
    }
  }
  // Retry on 429 (rate limit) and 5xx (transient server errors)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || (status >= 500 && status <= 599)) return true;
  }
  // Also check error message for HTTP status codes (e.g. LemonSqueezyClient throws
  // `new Error(...)` with status embedded in the message, not as a property)
  if (error instanceof Error) {
    const msg = error.message;
    if (/\b429\b/.test(msg) || /rate.?limit/i.test(msg)) return true;
    if (/\b5\d{2}\b/.test(msg)) return true;
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  if (maxAttempts < 1) {
    throw new Error('maxAttempts must be at least 1');
  }
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts && isRetryableError(error)) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.error(
          chalk.dim(`  ↻ Attempt ${attempt + 1}/${maxAttempts} for ${label} in ${delayMs}ms...`)
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

// ============================================================================
// Lemon Squeezy API Client
// ============================================================================

class LemonSqueezyClient {
  private apiKey: string;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';
  private storeId?: number;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  setStoreId(storeId: number): void {
    this.storeId = storeId;
  }

  private async request<T>(endpoint: string, page = 1, perPage = 100, filterByStore = false): Promise<LSApiResponse<T>> {
    return withRetry(
      async () => {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        url.searchParams.set('page[number]', page.toString());
        url.searchParams.set('page[size]', perPage.toString());
        // Filter by store_id to only fetch data from the validated store
        if (filterByStore && this.storeId) {
          url.searchParams.set('filter[store_id]', this.storeId.toString());
        }

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Lemon Squeezy API error (${response.status}): ${errorText}`);
        }

        return response.json() as Promise<LSApiResponse<T>>;
      },
      `${endpoint} (page ${page})`
    );
  }

  async *paginate<T>(endpoint: string, filterByStore = false): AsyncGenerator<T[], void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.request<T>(endpoint, page, 100, filterByStore);
      yield response.data;

      // Check for both undefined and null - JSON:API spec allows null for unavailable links
      hasMore = response.links.next != null;
      page++;

      // Rate limit: LS allows 300 requests per minute (5 req/sec)
      // Using 200ms delay for safety margin
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  async fetchAll<T>(endpoint: string, filterByStore = false): Promise<T[]> {
    const items: T[] = [];
    for await (const batch of this.paginate<T>(endpoint, filterByStore)) {
      items.push(...batch);
    }
    return items;
  }

  async getProducts(): Promise<LSProduct[]> {
    return this.fetchAll<LSProduct>('/products', true);
  }

  async getVariants(): Promise<LSVariant[]> {
    // Variants endpoint doesn't support store_id filter - filter client-side via product_id
    return this.fetchAll<LSVariant>('/variants', false);
  }

  async getDiscounts(): Promise<LSDiscount[]> {
    return this.fetchAll<LSDiscount>('/discounts', true);
  }

  async getCustomers(): Promise<LSCustomer[]> {
    return this.fetchAll<LSCustomer>('/customers', true);
  }

  async getFiles(): Promise<LSFile[]> {
    // Files endpoint doesn't support store_id filter - filtered in buildMigrationPlan via productMap
    return this.fetchAll<LSFile>('/files', false);
  }

  async validateKey(): Promise<{ valid: boolean; storeId?: number; currency?: string; error?: string }> {
    try {
      const response = await this.request<LSStore>('/stores', 1, 1);
      if (response.data.length === 0) {
        return { valid: false, error: 'No store found for this API key' };
      }
      const store = response.data[0];
      const storeId = parseInt(store.id, 10);
      // Get the store's currency - LS supports 150+ currencies, not just USD
      // Fail if currency is missing to avoid incorrect pricing during migration
      const currency = store.attributes?.currency;
      if (!currency) {
        return { valid: false, error: 'Store currency not found in API response. Cannot proceed with migration.' };
      }
      return { valid: true, storeId, currency };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================================================
// Mapping Functions
// ============================================================================

interface BillingPeriodResult {
  period: string | undefined;
  warning?: string;
  skip?: boolean;
}

function mapBillingPeriod(interval?: string, intervalCount?: number): BillingPeriodResult {
  // Missing interval for subscriptions should be skipped - can happen with deprecated LS variant fields
  // This function is only called when is_subscription is true, so missing interval is invalid
  if (!interval) {
    return {
      period: undefined,
      warning: 'Subscription variant missing billing interval (possibly deprecated LS field)',
      skip: true,
    };
  }

  // Map LS intervals to CREEM billing periods
  if (interval === 'month') {
    // Handle undefined intervalCount as default monthly (same pattern as year branch)
    if (intervalCount === 1 || intervalCount === undefined) return { period: 'every-month' };
    if (intervalCount === 3) return { period: 'every-three-months' };
    if (intervalCount === 6) return { period: 'every-six-months' };
    // Unsupported month intervals (2, 4, 5, etc.) - skip with warning
    return {
      period: undefined,
      warning: `${intervalCount}-month billing not supported in CREEM`,
      skip: true,
    };
  }
  if (interval === 'year') {
    if (intervalCount === 1 || intervalCount === undefined) {
      return { period: 'every-year' };
    }
    // Multi-year intervals not supported - skip to avoid pricing errors
    return {
      period: undefined,
      warning: `${intervalCount}-year billing not supported in CREEM`,
      skip: true,
    };
  }
  // Day/week intervals not supported in CREEM - MUST skip to avoid wrong pricing
  // A $5/week product silently becoming $5/month would be a 4x pricing error
  return {
    period: undefined,
    warning: `${interval} billing interval not supported in CREEM (would cause incorrect pricing)`,
    skip: true,
  };
}

function mapDiscountType(amountType: 'percent' | 'fixed'): 'percentage' | 'fixed' {
  return amountType === 'percent' ? 'percentage' : 'fixed';
}

/**
 * Map a Lemon Squeezy discount to CREEM discount format.
 * Centralized helper to avoid duplication across skipped and active discount handling.
 */
function mapLsDiscountToCreemDiscount(
  discount: LSDiscount,
  storeCurrency: 'USD' | 'EUR'
): MigrationPlan['discounts'][0]['creemDiscount'] {
  const creemDiscount: MigrationPlan['discounts'][0]['creemDiscount'] = {
    name: discount.attributes.name,
    code: discount.attributes.code,
    type: mapDiscountType(discount.attributes.amount_type),
    duration: discount.attributes.duration,
    durationInMonths: discount.attributes.duration_in_months,
    maxRedemptions: discount.attributes.is_limited_redemptions
      ? discount.attributes.max_redemptions
      : undefined,
    expiryDate: discount.attributes.expires_at
      ? new Date(discount.attributes.expires_at)
      : undefined,
  };

  // Set amount/percentage based on discount type
  if (discount.attributes.amount_type === 'percent') {
    creemDiscount.percentage = discount.attributes.amount;
  } else {
    // Fixed amount - LS stores in cents, CREEM also expects cents
    creemDiscount.amount = discount.attributes.amount;
    creemDiscount.currency = storeCurrency;
  }

  return creemDiscount;
}

/**
 * Get the effective price for a variant.
 * For PWYW (Pay What You Want) variants, the `price` field is deprecated and may be 0.
 * Instead, use min_price (minimum acceptable) or suggested_price (recommended) or 0 if none set.
 */
function getVariantPrice(variant: LSVariant): number {
  if (variant.attributes.pay_what_you_want) {
    // For PWYW, prefer min_price (sets a floor), fall back to suggested_price, then 0
    // Use || instead of ?? because min_price: 0 means "no minimum" in LS (should fall through)
    return variant.attributes.min_price || variant.attributes.suggested_price || 0;
  }
  return variant.attributes.price;
}

/**
 * Check if a variant is eligible for migration.
 * Must match the same criteria used in the main migration loop.
 */
function isVariantMigrateable(
  variant: LSVariant,
  product: LSProduct | undefined
): boolean {
  if (!product) return false;

  // Import all products regardless of status (draft, pending, published)
  // Users may want to migrate their entire catalog including work-in-progress

  // Skip variants with no price (unless PWYW)
  if (variant.attributes.price === 0 && !variant.attributes.pay_what_you_want) {
    return false;
  }

  // For recurring variants, check if billing interval is supported
  if (variant.attributes.is_subscription) {
    const billingResult = mapBillingPeriod(
      variant.attributes.interval,
      variant.attributes.interval_count
    );
    if (billingResult.skip) {
      return false;
    }
  }

  return true;
}

function buildMigrationPlan(
  products: LSProduct[],
  variants: LSVariant[],
  discounts: LSDiscount[],
  customers: LSCustomer[],
  files: LSFile[],
  storeCurrency: 'USD' | 'EUR' // Already validated before calling this function
): MigrationPlan {
  const productMap = new Map(products.map((p) => [parseInt(p.id, 10), p]));

  // Pre-compute migrateable variant counts per product to avoid O(N²) complexity
  const migrateableVariantCounts = new Map<number, number>();
  for (const variant of variants) {
    const productId = variant.attributes.product_id;
    const product = productMap.get(productId);
    if (isVariantMigrateable(variant, product)) {
      migrateableVariantCounts.set(productId, (migrateableVariantCounts.get(productId) || 0) + 1);
    }
  }

  // Build products from variants
  // Uses isVariantMigrateable as the single source of truth for eligibility checks
  const productPlan: MigrationPlan['products'] = [];
  for (const variant of variants) {
    const product = productMap.get(variant.attributes.product_id);
    if (!product) continue;

    const isRecurring = variant.attributes.is_subscription;
    const billingResult = isRecurring
      ? mapBillingPeriod(variant.attributes.interval, variant.attributes.interval_count)
      : { period: undefined };

    // Use pre-computed count for naming decision
    const productId = parseInt(product.id, 10);
    const migrateableVariantCount = migrateableVariantCounts.get(productId) || 0;
    const productName =
      migrateableVariantCount > 1
        ? `${product.attributes.name} - ${variant.attributes.name}`
        : product.attributes.name;

    // Use isVariantMigrateable for all eligibility checks
    if (!isVariantMigrateable(variant, product)) {
      // Determine the specific reason for skipping - ALWAYS track and report
      let skipReason: string;
      const hasPrice = variant.attributes.price > 0 || variant.attributes.pay_what_you_want;
      
      if (!hasPrice) {
        skipReason = 'Variant has no price set';
      } else if (billingResult.skip && billingResult.warning) {
        skipReason = billingResult.warning;
      } else {
        skipReason = 'Unknown eligibility issue';
      }
      
      productPlan.push({
        lsProduct: product,
        lsVariant: variant,
        creemProduct: {
          name: productName,
          description: product.attributes.description || '',
          price: getVariantPrice(variant),
          currency: storeCurrency,
          billingType: isRecurring ? 'recurring' : 'onetime',
          billingPeriod: billingResult.period,
          taxCategory: 'saas',
        },
        skipped: true,
        skipReason,
      });
      continue;
    }

    productPlan.push({
      lsProduct: product,
      lsVariant: variant,
      creemProduct: {
        name: productName,
        description: product.attributes.description || '',
        price: getVariantPrice(variant), // Use min_price/suggested_price for PWYW variants
        currency: storeCurrency, // Use store's configured currency (LS supports 150+ currencies)
        billingType: isRecurring ? 'recurring' : 'onetime',
        billingPeriod: billingResult.period,
        taxCategory: 'saas',
      },
    });
  }

  // Build discounts
  const discountPlan: MigrationPlan['discounts'] = [];
  for (const discount of discounts) {
    // Skip expired or inactive discounts
    if (discount.attributes.status !== 'published') {
      discountPlan.push({
        lsDiscount: discount,
        creemDiscount: mapLsDiscountToCreemDiscount(discount, storeCurrency),
        skipped: true,
        skipReason: `Discount status is "${discount.attributes.status}" (not published)`,
      });
      continue;
    }

    // Skip product-scoped discounts - LS API doesn't expose which products they apply to
    // Migrating them would apply to ALL products, potentially causing revenue loss
    if (discount.attributes.is_limited_to_products) {
      discountPlan.push({
        lsDiscount: discount,
        creemDiscount: mapLsDiscountToCreemDiscount(discount, storeCurrency),
        skipped: true,
        skipReason: 'Product-scoped discount (requires manual setup in CREEM to avoid applying to wrong products)',
      });
      continue;
    }

    // Map LS discount to CREEM format using centralized helper
    const creemDiscount = mapLsDiscountToCreemDiscount(discount, storeCurrency);

    discountPlan.push({
      lsDiscount: discount,
      creemDiscount,
    });
  }

  // Build customers
  const customerPlan: MigrationPlan['customers'] = [];
  for (const customer of customers) {
    customerPlan.push({
      lsCustomer: customer,
      creemCustomer: {
        email: customer.attributes.email,
        name: customer.attributes.name,
        billingAddress:
          customer.attributes.city || customer.attributes.country
            ? {
                city: customer.attributes.city,
                country: customer.attributes.country,
              }
            : undefined,
      },
    });
  }

  // Build files (for later reference)
  // Filter to only include files belonging to products in our store (via productMap)
  const filePlan: MigrationPlan['files'] = [];
  for (const file of files) {
    const variant = variants.find((v) => parseInt(v.id, 10) === file.attributes.variant_id);
    const product = variant ? productMap.get(variant.attributes.product_id) : undefined;

    // Skip files that don't belong to products in our store
    if (!product) continue;

    filePlan.push({
      lsFile: file,
      variantId: file.attributes.variant_id.toString(),
      productName: product.attributes.name,
    });
  }

  const migrateableProducts = productPlan.filter((p) => !p.skipped);
  const skippedProducts = productPlan.filter((p) => p.skipped);
  const migrateableDiscounts = discountPlan.filter((d) => !d.skipped);
  const skippedDiscounts = discountPlan.filter((d) => d.skipped);

  return {
    products: productPlan,
    discounts: discountPlan,
    customers: customerPlan,
    files: filePlan,
    summary: {
      totalProducts: migrateableProducts.length,
      totalDiscounts: migrateableDiscounts.length,
      totalCustomers: customerPlan.length,
      totalFiles: filePlan.length,
      skippedProducts: skippedProducts.length,
      skippedDiscounts: skippedDiscounts.length,
    },
  };
}

// ============================================================================
// Migration Execution
// ============================================================================

async function executeMigration(
  plan: MigrationPlan,
  options: { dryRun: boolean }
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    created: { products: [], discounts: [], customers: [], files: [] },
    failed: { products: [], discounts: [], customers: [], files: [] },
    skipped: { products: [], discounts: [], customers: [] },
  };

  if (options.dryRun) {
    console.log();
    console.log(chalk.yellow('DRY RUN MODE - No changes will be made'));
    console.log();
    return result;
  }

  const client = getClient();

  // Migrate Products (skip products with unsupported billing intervals)
  const migrateableProducts = plan.products.filter((p) => !p.skipped);
  const skippedProducts = plan.products.filter((p) => p.skipped);

  console.log();
  console.log(chalk.bold('Migrating Products...'));

  // Record skipped products first
  for (const skipped of skippedProducts) {
    result.skipped.products.push({
      name: skipped.creemProduct.name,
      reason: skipped.skipReason || 'Unsupported billing interval',
    });
  }

  for (let i = 0; i < migrateableProducts.length; i++) {
    const item = migrateableProducts[i];
    const progress = `[${i + 1}/${migrateableProducts.length}]`;

    const spinner = ora(`${progress} Creating: ${item.creemProduct.name}`).start();

    try {
      const params: Parameters<typeof client.products.create>[0] = {
        name: item.creemProduct.name,
        // CREEM API requires description to be a non-empty string
        // Use product name as fallback if no description is provided
        description: item.creemProduct.description || item.creemProduct.name,
        price: item.creemProduct.price,
        currency: item.creemProduct.currency as 'USD' | 'EUR',
        billingType: item.creemProduct.billingType as 'recurring' | 'onetime',
        taxCategory: item.creemProduct.taxCategory as 'saas' | 'digital-goods-service' | 'ebooks',
      };

      if (item.creemProduct.billingPeriod) {
        params.billingPeriod = item.creemProduct.billingPeriod as
          | 'every-month'
          | 'every-three-months'
          | 'every-six-months'
          | 'every-year';
      }

      // NOTE: Retrying a POST create is not idempotent — a transient failure after the server
      // processes the request could lead to a duplicate product. This is an acceptable tradeoff:
      // duplicates can be cleaned up manually, whereas failing the entire migration is worse.
      const created = (await withRetry(
        () => client.products.create(params),
        `product "${item.creemProduct.name}"`
      )) as unknown as { id: string };
      result.created.products.push(created.id);
      spinner.succeed(`${progress} Created: ${item.creemProduct.name}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.failed.products.push({ name: item.creemProduct.name, error: errorMsg });
      spinner.fail(`${progress} Failed: ${item.creemProduct.name} - ${errorMsg}`);
      result.success = false;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Migrate Discounts (after products so we can apply to all created products)
  const migrateableDiscounts = plan.discounts.filter((d) => !d.skipped);
  const skippedDiscounts = plan.discounts.filter((d) => d.skipped);

  if (plan.discounts.length > 0) {
    console.log();
    console.log(chalk.bold('Migrating Discounts...'));

    // Record skipped discounts first
    for (const skipped of skippedDiscounts) {
      result.skipped.discounts.push({
        code: skipped.creemDiscount.code,
        reason: skipped.skipReason || 'Discount not active',
      });
    }

    // Skip discount creation if no products were successfully created
    // CREEM API requires at least one product for discounts to apply to
    if (result.created.products.length === 0 && migrateableDiscounts.length > 0) {
      console.log(
        chalk.yellow(`  ⚠ Skipping ${migrateableDiscounts.length} discount(s): No products were created to apply them to`)
      );
      for (const item of migrateableDiscounts) {
        result.skipped.discounts.push({
          code: item.creemDiscount.code,
          reason: 'No products available to apply discount to',
        });
      }
    }

    // Create discounts - apply to all created products
    for (let i = 0; i < (result.created.products.length > 0 ? migrateableDiscounts.length : 0); i++) {
      const item = migrateableDiscounts[i];
      const progress = `[${i + 1}/${migrateableDiscounts.length}]`;

      const spinner = ora(`${progress} Creating: ${item.creemDiscount.code}`).start();

      try {
        // Build discount creation params
        const params: Parameters<typeof client.discounts.create>[0] = {
          name: item.creemDiscount.name,
          code: item.creemDiscount.code,
          type: item.creemDiscount.type,
          duration: item.creemDiscount.duration,
          // Apply to all created products from this migration
          appliesToProducts: result.created.products,
        };

        // Set amount/percentage based on type
        if (item.creemDiscount.type === 'percentage' && item.creemDiscount.percentage !== undefined) {
          params.percentage = item.creemDiscount.percentage;
        } else if (item.creemDiscount.type === 'fixed' && item.creemDiscount.amount !== undefined) {
          params.amount = item.creemDiscount.amount;
          params.currency = item.creemDiscount.currency;
        }

        // Optional fields
        if (item.creemDiscount.expiryDate) {
          params.expiryDate = item.creemDiscount.expiryDate;
        }
        if (item.creemDiscount.maxRedemptions !== undefined) {
          params.maxRedemptions = item.creemDiscount.maxRedemptions;
        }
        if (item.creemDiscount.duration === 'repeating' && item.creemDiscount.durationInMonths !== undefined) {
          params.durationInMonths = item.creemDiscount.durationInMonths;
        }

        // NOTE: Retrying a POST create is not idempotent — see product create comment above.
        // Discount codes are unique, so duplicates will fail with a conflict error rather than
        // silently creating duplicates.
        const created = (await withRetry(
          () => client.discounts.create(params),
          `discount "${item.creemDiscount.code}"`
        )) as unknown as { id: string; code: string };
        result.created.discounts.push(created.id);
        spinner.succeed(`${progress} Created: ${item.creemDiscount.code}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.failed.discounts.push({ code: item.creemDiscount.code, error: errorMsg });
        spinner.fail(`${progress} Failed: ${item.creemDiscount.code} - ${errorMsg}`);
        result.success = false;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Note: Customer and File migration require additional CREEM API endpoints
  // that are not yet available in the SDK. Logging for manual follow-up.

  if (plan.customers.length > 0) {
    console.log();
    console.log(
      chalk.yellow(`⚠ ${plan.customers.length} customers found - will be created automatically on first purchase`)
    );
    console.log(chalk.dim('  Customers are auto-created in CREEM when they make their first purchase'));
  }

  if (plan.files.length > 0) {
    console.log();
    console.log(
      chalk.yellow(`⚠ ${plan.files.length} files found - manual upload required`)
    );
    console.log(chalk.dim('  Upload downloadable files in the CREEM dashboard'));
  }

  return result;
}

// ============================================================================
// CLI Commands
// ============================================================================

function createLemonSqueezyCommand(): Command {
  const command = new Command('lemon-squeezy')
    .description('Migrate from Lemon Squeezy to CREEM')
    .option('--ls-api-key <key>', 'Lemon Squeezy API key')
    .option('--dry-run', 'Preview migration without making changes')
    // Note: --log-file is not yet implemented - will be added in future version
    .option('--json', 'Output migration plan as JSON (implies --dry-run)')
    .option('--exclude-discounts', 'Skip migrating discounts entirely')
    .action(async (options: { lsApiKey?: string; dryRun?: boolean; json?: boolean; excludeDiscounts?: boolean }) => {
      // Skip banner when outputting JSON to avoid corrupting stdout
      if (!options.json) {
        console.log();
        console.log(chalk.bold.cyan('🍋 Lemon Squeezy → CREEM Migration'));
        console.log(chalk.dim('Migrate your products, customers, and discounts'));
        console.log();
      }

      // Verify CREEM authentication
      try {
        getClient();
      } catch {
        output.error('Not authenticated with CREEM. Run `creem login` first.');
        process.exit(1);
      }

      // Get Lemon Squeezy API key
      let lsApiKey = options.lsApiKey;

      if (!lsApiKey) {
        try {
          lsApiKey = await password({
            message: 'Enter your Lemon Squeezy API key:',
            validate: (value) => (value.length > 0 ? true : 'API key is required'),
          });
        } catch {
          console.log(chalk.dim('\nMigration cancelled.'));
          return;
        }

        if (!lsApiKey) {
          console.log(chalk.dim('\nMigration cancelled.'));
          return;
        }
      }

      // Validate Lemon Squeezy API key
      const lsClient = new LemonSqueezyClient(lsApiKey);
      const validateSpinner = ora('Validating Lemon Squeezy API key...').start();

      const validation = await lsClient.validateKey();
      if (!validation.valid) {
        validateSpinner.fail('Invalid Lemon Squeezy API key');
        output.error(validation.error || 'Could not validate API key');
        process.exit(1);
      }

      validateSpinner.succeed(`Connected to Lemon Squeezy (Store ID: ${validation.storeId})`);

      // Set store ID for filtering subsequent API requests
      lsClient.setStoreId(validation.storeId!);

      // Validate store currency - CREEM only supports USD and EUR
      // Currency must exist (validated in validateKey), but guard against edge cases
      if (!validation.currency) {
        output.error('Store currency not found. Cannot proceed with migration.');
        process.exit(1);
      }
      const rawCurrency = validation.currency.toUpperCase();
      if (rawCurrency !== 'USD' && rawCurrency !== 'EUR') {
        output.error(
          `Your Lemon Squeezy store uses ${rawCurrency}, but CREEM currently only supports USD and EUR.\n` +
            `To migrate, please either:\n` +
            `  1. Change your Lemon Squeezy store currency to USD or EUR before migration\n` +
            `  2. Contact CREEM support for assistance with currency conversion\n` +
            `\nNote: Migrating with incorrect currency would result in wrong pricing in CREEM.`
        );
        process.exit(1);
      }
      const storeCurrency: 'USD' | 'EUR' = rawCurrency;

      // Fetch data from Lemon Squeezy
      const fetchSpinner = ora('Fetching data from Lemon Squeezy...').start();

      let products: LSProduct[] = [];
      let variants: LSVariant[] = [];
      let discounts: LSDiscount[] = [];
      let customers: LSCustomer[] = [];
      let files: LSFile[] = [];
      const fetchFailures: FailedEntity[] = [];

      fetchSpinner.text = 'Fetching products...';
      try {
        products = await lsClient.getProducts();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        fetchFailures.push({ type: 'product', label: 'all products', error: msg });
        fetchSpinner.text = 'Products fetch failed, continuing...';
      }

      fetchSpinner.text = 'Fetching variants...';
      try {
        variants = await lsClient.getVariants();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        fetchFailures.push({ type: 'variant', label: 'all variants', error: msg });
        fetchSpinner.text = 'Variants fetch failed, continuing...';
      }

      if (options.excludeDiscounts) {
        discounts = [];
      } else {
        fetchSpinner.text = 'Fetching discounts...';
        try {
          discounts = await lsClient.getDiscounts();
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          fetchFailures.push({ type: 'discount', label: 'all discounts', error: msg });
          fetchSpinner.text = 'Discounts fetch failed, continuing...';
        }
      }

      fetchSpinner.text = 'Fetching customers...';
      try {
        customers = await lsClient.getCustomers();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        fetchFailures.push({ type: 'customer', label: 'all customers', error: msg });
        fetchSpinner.text = 'Customers fetch failed, continuing...';
      }

      fetchSpinner.text = 'Fetching files...';
      try {
        files = await lsClient.getFiles();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        fetchFailures.push({ type: 'file', label: 'all files', error: msg });
        fetchSpinner.text = 'Files fetch failed, continuing...';
      }

      {
        const discountsLabel = options.excludeDiscounts ? 'discounts excluded' : `${discounts.length} discounts`;
        const failLabel = fetchFailures.length > 0 ? chalk.yellow(` (${fetchFailures.length} fetch failures)`) : '';
        fetchSpinner.succeed(
          `Fetched: ${products.length} products, ${variants.length} variants, ${discountsLabel}, ${customers.length} customers, ${files.length} files${failLabel}`
        );
      }

      if (fetchFailures.length > 0 && !options.json) {
        console.error();
        console.error(chalk.yellow('⚠ Some data could not be fetched after retries:'));
        for (const f of fetchFailures) {
          console.error(`  • ${f.type}: ${f.label} - ${f.error}`);
        }
        console.error(chalk.dim('  Migration will continue with the data that was successfully fetched.'));
      }

      // Build migration plan (storeCurrency already validated as USD or EUR above)
      const planSpinner = ora('Building migration plan...').start();
      const plan = buildMigrationPlan(products, variants, discounts, customers, files, storeCurrency);
      planSpinner.succeed('Migration plan ready');

      // If JSON output requested, print and exit
      if (options.json) {
        const jsonOutput = fetchFailures.length > 0
          ? { ...plan, fetchFailures }
          : plan;
        output.outputJson(jsonOutput);
        return;
      }

      // Display migration summary
      console.log();
      console.log(chalk.bold('Migration Summary'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  Products:  ${chalk.cyan(plan.summary.totalProducts)} CREEM products from ${variants.length} LS variants`);
      if (plan.summary.skippedProducts > 0) {
        console.log(
          `  Skipped:   ${chalk.yellow(plan.summary.skippedProducts)} variants (see details below)`
        );
      }
      if (options.excludeDiscounts) {
        console.log(`  Discounts: ${chalk.yellow('excluded')} (--exclude-discounts)`);
      } else {
        console.log(`  Discounts: ${chalk.cyan(plan.summary.totalDiscounts)}${plan.summary.skippedDiscounts > 0 ? chalk.yellow(` (${plan.summary.skippedDiscounts} skipped)`) : ''}`);
      }
      console.log(`  Customers: ${chalk.cyan(plan.summary.totalCustomers)}`);
      console.log(`  Files:     ${chalk.cyan(plan.summary.totalFiles)} (manual upload required)`);
      console.log(chalk.dim('─'.repeat(50)));

      if (plan.summary.totalProducts === 0 && plan.summary.totalCustomers === 0) {
        console.log();
        if (plan.summary.skippedProducts > 0) {
          // All products were skipped - show why
          console.log(
            chalk.yellow(
              `No products can be migrated. ${plan.summary.skippedProducts} variant(s) were skipped:`
            )
          );
          console.log();
          const skippedProductsList = plan.products.filter((p) => p.skipped);
          
          // Group by skip reason for cleaner output
          const reasonCounts = new Map<string, number>();
          for (const p of skippedProductsList) {
            const reason = p.skipReason || 'Unknown reason';
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
          }
          
          console.log(chalk.dim('Skip reasons:'));
          for (const [reason, count] of reasonCounts) {
            console.log(`  • ${chalk.yellow(count)} variant(s): ${reason}`);
          }
          console.log();
          console.log(chalk.dim('Products may be skipped due to unsupported billing intervals or pricing.'));
          console.log(chalk.dim('CREEM supports one-time, monthly, and yearly billing cycles.'));
        } else {
          console.log(chalk.yellow('Nothing to migrate. Your Lemon Squeezy account appears empty.'));
        }
        return;
      }

      // Show sample products (only migrateable ones)
      const migrateableProducts = plan.products.filter((p) => !p.skipped);
      const skippedProductsList = plan.products.filter((p) => p.skipped);

      if (migrateableProducts.length > 0) {
        console.log();
        console.log(chalk.dim('Sample products to be created:'));
        const sample = migrateableProducts.slice(0, 5);
        for (const p of sample) {
          const price = output.formatCurrency(p.creemProduct.price, p.creemProduct.currency);
          const billing =
            p.creemProduct.billingType === 'recurring'
              ? `Recurring / ${p.creemProduct.billingPeriod?.replace('every-', '')}`
              : 'One-time';
          console.log(`  • ${p.creemProduct.name} - ${price} (${billing})`);
        }
        if (migrateableProducts.length > 5) {
          console.log(chalk.dim(`  ... and ${migrateableProducts.length - 5} more`));
        }
      }

      // Show skipped products with reasons
      if (skippedProductsList.length > 0) {
        console.log();
        console.log(chalk.yellow(`⚠ ${skippedProductsList.length} variant(s) cannot be migrated:`));
        
        // Group by skip reason for cleaner output
        const reasonCounts = new Map<string, string[]>();
        for (const p of skippedProductsList) {
          const reason = p.skipReason || 'Unknown reason';
          if (!reasonCounts.has(reason)) {
            reasonCounts.set(reason, []);
          }
          reasonCounts.get(reason)!.push(p.creemProduct.name);
        }
        
        for (const [reason, names] of reasonCounts) {
          console.log(`  • ${reason}: ${chalk.dim(`${names.length} variant(s)`)}`);
          // Show first 2 names as examples
          for (const name of names.slice(0, 2)) {
            console.log(chalk.dim(`      - ${name}`));
          }
          if (names.length > 2) {
            console.log(chalk.dim(`      ... and ${names.length - 2} more`));
          }
        }
      }

      // Show skipped discounts with reasons
      const skippedDiscountsList = plan.discounts.filter((d) => d.skipped);
      if (skippedDiscountsList.length > 0) {
        console.log();
        console.log(chalk.yellow(`⚠ ${skippedDiscountsList.length} discount(s) require manual setup:`));
        
        // Group by skip reason for cleaner output
        const discountReasonCounts = new Map<string, string[]>();
        for (const d of skippedDiscountsList) {
          const reason = d.skipReason || 'Unknown reason';
          if (!discountReasonCounts.has(reason)) {
            discountReasonCounts.set(reason, []);
          }
          discountReasonCounts.get(reason)!.push(d.creemDiscount.code);
        }
        
        for (const [reason, codes] of discountReasonCounts) {
          console.log(`  • ${reason}: ${chalk.dim(`${codes.length} discount(s)`)}`);
          // Show first 3 codes as examples
          for (const code of codes.slice(0, 3)) {
            console.log(chalk.dim(`      - ${code}`));
          }
          if (codes.length > 3) {
            console.log(chalk.dim(`      ... and ${codes.length - 3} more`));
          }
        }
      }

      // Dry run mode
      if (options.dryRun) {
        console.log();
        console.log(chalk.yellow.bold('DRY RUN MODE'));
        console.log(chalk.dim('No changes were made. Remove --dry-run to execute migration.'));
        return;
      }

      // Confirmation prompt
      console.log();
      let proceed: boolean;
      try {
        proceed = await confirm({
          message: 'Proceed with migration?',
          default: false,
        });
      } catch {
        console.log(chalk.dim('\nMigration cancelled.'));
        return;
      }

      if (!proceed) {
        console.log(chalk.dim('\nMigration cancelled.'));
        return;
      }

      // Execute migration
      console.log();
      console.log(chalk.bold.green('Starting migration...'));

      const result = await executeMigration(plan, {
        dryRun: false,
      });

      // Display results
      console.log();
      console.log(chalk.bold('Migration Complete'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log(`  Products created:  ${chalk.green(result.created.products.length)}`);
      console.log(`  Discounts created: ${chalk.green(result.created.discounts.length)}`);

      if (result.failed.products.length > 0 || result.failed.discounts.length > 0) {
        console.log();
        console.log(chalk.red('Failed items:'));
        for (const f of result.failed.products) {
          console.log(`  • Product: ${f.name} - ${f.error}`);
        }
        for (const f of result.failed.discounts) {
          console.log(`  • Discount: ${f.code} - ${f.error}`);
        }
      }

      if (result.skipped.discounts.length > 0) {
        console.log();
        console.log(chalk.yellow('Skipped discounts:'));
        for (const s of result.skipped.discounts.slice(0, 5)) {
          console.log(`  • ${s.code}: ${s.reason}`);
        }
        if (result.skipped.discounts.length > 5) {
          console.log(chalk.dim(`  ... and ${result.skipped.discounts.length - 5} more`));
        }
      }

      console.log(chalk.dim('─'.repeat(50)));

      if (fetchFailures.length > 0) {
        console.error();
        console.error(chalk.red('Failed to fetch (after retries):'));
        for (const f of fetchFailures) {
          console.error(`  • ${f.type}: ${f.label} - ${f.error}`);
        }
      }

      if (result.success && fetchFailures.length === 0) {
        console.log();
        console.log(chalk.green.bold('✓ Migration completed successfully!'));
      } else {
        console.log();
        console.log(chalk.yellow.bold('⚠ Migration completed with some errors.'));
        if (fetchFailures.length > 0) {
          console.log(chalk.dim('  Re-run the migration to retry failed fetches.'));
        }
      }

      console.log();
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.dim('  1. Review your products at https://creem.io/dashboard/products'));
      console.log(chalk.dim('  2. Review your discounts at https://creem.io/dashboard/discounts'));
      console.log(chalk.dim('  3. Upload downloadable files in the dashboard if needed'));
      console.log(chalk.dim('  4. Update your checkout links to use CREEM'));
    });

  return command;
}

export function createMigrateCommand(): Command {
  const command = new Command('migrate')
    .description('Migrate from other platforms to CREEM')
    .addHelpText(
      'after',
      `
${chalk.dim('Available migrations:')}
  ${chalk.cyan('creem migrate lemon-squeezy')}    Migrate from Lemon Squeezy

${chalk.dim('Options:')}
  --dry-run               Preview what would be migrated without making changes
  --ls-api-key <key>      Provide API key via flag (skips interactive prompt)
  --json                  Output migration plan as JSON
  --exclude-discounts     Skip migrating discounts entirely

${chalk.dim('Examples:')}
  ${chalk.cyan('creem migrate lemon-squeezy')}                    Interactive migration wizard
  ${chalk.cyan('creem migrate lemon-squeezy --dry-run')}          Preview migration plan
  ${chalk.cyan('creem migrate lemon-squeezy --json > plan.json')} Export migration plan
`
    );

  command.addCommand(createLemonSqueezyCommand());

  return command;
}
