/**
 * Shared test data module that creates test resources lazily.
 * Resources are created once and cached for all tests.
 */
import { Creem } from "../../src/index.js";
import { TEST_API_KEY, TEST_SERVER_IDX } from "./testValues.js";
import type { ProductEntity, DiscountEntity, CheckoutEntity } from "../../src/models/components/index.js";
import {
  DiscountType,
  CouponDurationType,
  ProductRequestBillingType,
  ProductRequestBillingPeriod,
  ProductCurrency,
  TaxMode,
  TaxCategory,
} from "../../src/models/components/index.js";

// Shared Creem client instance
export const creem = new Creem({
  apiKey: TEST_API_KEY,
  serverIdx: TEST_SERVER_IDX,
});

// Cache for created test resources
let cachedProduct: ProductEntity | null = null;
let cachedOneTimeProduct: ProductEntity | null = null;
let cachedDiscount: DiscountEntity | null = null;
let cachedCheckout: CheckoutEntity | null = null;

/**
 * Get or create a test subscription product.
 * Creates a recurring product if one doesn't exist.
 */
export async function getTestProduct(): Promise<ProductEntity> {
  if (cachedProduct) {
    return cachedProduct;
  }

  console.log("[Test Setup] Creating test subscription product...");
  
  cachedProduct = await creem.products.create({
    name: `Test Product ${Date.now()}`,
    description: "Test subscription product for SDK tests",
    price: 1000, // $10.00
    currency: ProductCurrency.Eur,
    billingType: ProductRequestBillingType.Recurring,
    billingPeriod: ProductRequestBillingPeriod.EveryMonth,
    taxMode: TaxMode.Inclusive,
    taxCategory: TaxCategory.Saas,
    defaultSuccessUrl: "https://example.com/success",
  });

  console.log(`[Test Setup] Created test product: ${cachedProduct.id}`);
  return cachedProduct;
}

/**
 * Get or create a test one-time product.
 * 
 * NOTE: This function currently fails due to a mismatch between the SDK and API:
 * - ProductRequestBillingType uses "onetime" for requests (correct)
 * - ProductBillingType expects "one-time" for responses, but API returns "onetime"
 * This will be fixed when the SDK is regenerated.
 */
export async function getTestOneTimeProduct(): Promise<ProductEntity> {
  if (cachedOneTimeProduct) {
    return cachedOneTimeProduct;
  }

  console.log("[Test Setup] Creating test one-time product...");
  
  cachedOneTimeProduct = await creem.products.create({
    name: `Test One-Time Product ${Date.now()}`,
    description: "Test one-time product for SDK tests",
    price: 500, // $5.00
    currency: ProductCurrency.Eur,
    billingType: ProductRequestBillingType.Onetime,
    taxMode: TaxMode.Inclusive,
    taxCategory: TaxCategory.Saas,
  });

  console.log(`[Test Setup] Created test one-time product: ${cachedOneTimeProduct.id}`);
  return cachedOneTimeProduct;
}

/**
 * Get or create a test discount.
 * Requires a product to exist first.
 */
export async function getTestDiscount(): Promise<DiscountEntity> {
  if (cachedDiscount) {
    return cachedDiscount;
  }

  const product = await getTestProduct();
  
  console.log("[Test Setup] Creating test discount...");
  
  cachedDiscount = await creem.discounts.create({
    name: `Test Discount ${Date.now()}`,
    type: DiscountType.Percentage,
    percentage: 10,
    duration: CouponDurationType.Forever,
    appliesToProducts: [product.id],
  });

  console.log(`[Test Setup] Created test discount: ${cachedDiscount.id}`);
  return cachedDiscount;
}

/**
 * Get or create a test checkout.
 * Requires a product to exist first.
 */
export async function getTestCheckout(): Promise<CheckoutEntity> {
  if (cachedCheckout) {
    return cachedCheckout;
  }

  const product = await getTestProduct();
  
  console.log("[Test Setup] Creating test checkout...");
  
  cachedCheckout = await creem.checkouts.create({
    productId: product.id,
  });

  console.log(`[Test Setup] Created test checkout: ${cachedCheckout.id}`);
  return cachedCheckout;
}

/**
 * Clear all cached test data.
 * Useful if you need to force recreation of resources.
 */
export function clearTestDataCache(): void {
  cachedProduct = null;
  cachedOneTimeProduct = null;
  cachedDiscount = null;
  cachedCheckout = null;
}
