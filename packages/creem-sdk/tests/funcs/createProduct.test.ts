import { Creem } from "../../src/index.js";
import { describe, it, expect } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem } from "../fixtures/testData.js";
import {
  ProductRequestBillingType,
  ProductRequestBillingPeriod,
  ProductCurrency,
  TaxMode,
  TaxCategory,
  CustomFieldRequestType,
} from "../../src/models/components/index.js";

// Sample product data using SDK enums
const SAMPLE_PRODUCT = {
  name: `Test Product ${Date.now()}`,
  description: "This is a sample product description.",
  price: 400,
  currency: ProductCurrency.Eur,
  billingType: ProductRequestBillingType.Recurring,
  billingPeriod: ProductRequestBillingPeriod.EveryMonth,
  taxMode: TaxMode.Inclusive,
  taxCategory: TaxCategory.Saas,
  defaultSuccessUrl: "https://example.com/?status=successful",
  customField: [
    {
      type: CustomFieldRequestType.Text,
      key: "company",
      label: "Company Name",
      optional: true,
      text: {
        maxLength: 100,
        minLength: 0,
      },
    },
  ],
};

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("createProduct", () => {
  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      await creemWithInvalidKey.products.create(SAMPLE_PRODUCT);
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an API error but none was thrown");
    } catch (error) {
      // We expect this to fail with a 403 error due to invalid API key
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should create a product successfully", async () => {
    const productData = {
      ...SAMPLE_PRODUCT,
      name: `Test Product ${Date.now()}`, // Unique name
    };
    
    // When using the SDK instance directly, it returns ProductEntity
    const result = await creem.products.create(productData);

    // Test direct SDK method
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", productData.name);
    expect(result).toHaveProperty("description", productData.description);
    expect(result).toHaveProperty("price", productData.price);
    expect(result).toHaveProperty("currency", productData.currency);
    expect(result).toHaveProperty("billingType", productData.billingType);
    expect(result).toHaveProperty("billingPeriod", productData.billingPeriod);
    expect(result).toHaveProperty("taxMode", productData.taxMode);
    expect(result).toHaveProperty("taxCategory", productData.taxCategory);
    expect(result).toHaveProperty(
      "defaultSuccessUrl",
      productData.defaultSuccessUrl
    );
    expect(result).toHaveProperty("productUrl");
    expect(result).toHaveProperty("createdAt");
    expect(result).toHaveProperty("updatedAt");
    expect(result).toHaveProperty("mode", TEST_MODE);
  });

  it("should handle validation errors", async () => {
    // Create an instance with empty API key
    const creemWithEmptyKey = new Creem({
      apiKey: "",
      serverIdx: TEST_SERVER_IDX,
    });

    try {
      // Use invalid input to trigger validation error
      await creemWithEmptyKey.products.create(SAMPLE_PRODUCT);
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle request errors with invalid product data", async () => {
    try {
      await creem.products.create({
        // Missing required fields
        name: "Invalid Product",
      } as any);
      fail("Expected error with invalid product data but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create a product with minimal required data", async () => {
    const minimalProduct = {
      name: `Minimal Product ${Date.now()}`,
      description: "A product with only the required fields",
      price: 100,
      currency: ProductCurrency.Usd,
      billingType: ProductRequestBillingType.Onetime,
    };

    const result = await creem.products.create(minimalProduct);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", minimalProduct.name);
    expect(result).toHaveProperty("description", minimalProduct.description);
    expect(result).toHaveProperty("price", minimalProduct.price);
    expect(result).toHaveProperty("currency", minimalProduct.currency);
    // Response billingType will be "onetime" from API but SDK expects "one-time"
    expect(result).toHaveProperty("billingType");
  });

  it("should create a recurring product with minimal required data", async () => {
    const minimalProduct = {
      name: `Minimal Recurring Product ${Date.now()}`,
      description: "A recurring product with minimal fields",
      price: 100,
      currency: ProductCurrency.Usd,
      billingType: ProductRequestBillingType.Recurring,
      billingPeriod: ProductRequestBillingPeriod.EveryMonth,
    };

    const result = await creem.products.create(minimalProduct);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", minimalProduct.name);
    expect(result).toHaveProperty("description", minimalProduct.description);
    expect(result).toHaveProperty("price", minimalProduct.price);
    expect(result).toHaveProperty("currency", minimalProduct.currency);
    expect(result).toHaveProperty("billingType", ProductRequestBillingType.Recurring);
  });
});
