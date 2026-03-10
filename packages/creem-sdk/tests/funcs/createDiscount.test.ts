import { Creem } from "../../src/index.js";
import { describe, it, expect, beforeAll } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import * as components from "../../src/models/components/index.js";
import { TEST_SERVER_IDX, TEST_MODE } from "../fixtures/testValues.js";
import { creem, getTestProduct } from "../fixtures/testData.js";
import type { ProductEntity } from "../../src/models/components/index.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

// Store created discount IDs and codes for use in retrieve tests
export let createdPercentageDiscountId: string | undefined;
export let createdPercentageDiscountCode: string | undefined;
export let createdFixedDiscountId: string | undefined;
export let createdFixedDiscountCode: string | undefined;

describe("createDiscount - Percentage Discounts", () => {
  let testProduct: ProductEntity;
  let samplePercentageDiscount: components.CreateDiscountRequestEntity;

  beforeAll(async () => {
    testProduct = await getTestProduct();
    samplePercentageDiscount = {
      name: `Test Percentage Discount ${Date.now()}`,
      type: components.DiscountType.Percentage,
      percentage: 20,
      duration: components.CouponDurationType.Forever,
      appliesToProducts: [testProduct.id],
    };
  });

  it("should handle API authentication errors", async () => {
    try {
      await creemWithInvalidKey.discounts.create(samplePercentageDiscount);
      fail("Expected an API error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
    }
  });

  it("should create a percentage discount successfully", async () => {
    const result = await creem.discounts.create(samplePercentageDiscount);

    // Store the created discount ID and code
    createdPercentageDiscountId = result.id;
    createdPercentageDiscountCode = result.code;

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("mode", TEST_MODE);
    expect(result).toHaveProperty("object");
    expect(result).toHaveProperty("status", "active");
    expect(result).toHaveProperty("name", samplePercentageDiscount.name);
    expect(result).toHaveProperty("code");
    expect(result).toHaveProperty("type", samplePercentageDiscount.type);
    expect(result).toHaveProperty(
      "percentage",
      samplePercentageDiscount.percentage
    );
    expect(result).toHaveProperty(
      "duration",
      samplePercentageDiscount.duration
    );
  });

  it("should create a percentage discount with advanced options successfully", async () => {
    const advancedDiscount: components.CreateDiscountRequestEntity = {
      name: `Adv Pct Disc ${Date.now()}`.slice(0, 40),
      type: components.DiscountType.Percentage,
      percentage: 15,
      duration: components.CouponDurationType.Repeating,
      durationInMonths: 3,
      maxRedemptions: 100,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      appliesToProducts: [testProduct.id],
    };

    const result = await creem.discounts.create(advancedDiscount);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", advancedDiscount.name);
    expect(result).toHaveProperty("type", advancedDiscount.type);
    expect(result).toHaveProperty("percentage", advancedDiscount.percentage);
    expect(result).toHaveProperty("duration", advancedDiscount.duration);
    expect(result).toHaveProperty(
      "durationInMonths",
      advancedDiscount.durationInMonths
    );
    expect(result).toHaveProperty(
      "maxRedemptions",
      advancedDiscount.maxRedemptions
    );
    expect(result).toHaveProperty("expiryDate");
  });

  it("should handle validation errors", async () => {
    // Create an instance with empty API key
    const creemWithEmptyKey = new Creem({
      apiKey: "",
      serverIdx: TEST_SERVER_IDX,
    });

    try {
      await creemWithEmptyKey.discounts.create(samplePercentageDiscount);
      fail("Expected validation error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle request errors with invalid discount data", async () => {
    try {
      await creem.discounts.create({
        // Missing required fields
        name: "Invalid Discount",
      } as any);
      fail("Expected error with invalid discount data but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("createDiscount - Fixed Amount Discounts", () => {
  let testProduct: ProductEntity;
  let sampleFixedDiscount: components.CreateDiscountRequestEntity;

  beforeAll(async () => {
    testProduct = await getTestProduct();
    sampleFixedDiscount = {
      name: `Test Fixed Discount ${Date.now()}`,
      type: components.DiscountType.Fixed,
      amount: 1000,
      currency: "EUR",
      duration: components.CouponDurationType.Once,
      appliesToProducts: [testProduct.id],
    };
  });

  it("should create a fixed amount discount successfully", async () => {
    const result = await creem.discounts.create(sampleFixedDiscount);

    // Store the created discount ID and code
    createdFixedDiscountId = result.id;
    createdFixedDiscountCode = result.code;

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", sampleFixedDiscount.name);
    expect(result).toHaveProperty("type", sampleFixedDiscount.type);
    expect(result).toHaveProperty("amount", sampleFixedDiscount.amount);
    expect(result).toHaveProperty("currency", sampleFixedDiscount.currency);
    expect(result).toHaveProperty("duration", sampleFixedDiscount.duration);
  });

  it("should create a fixed amount discount with advanced options successfully", async () => {
    const advancedFixedDiscount: components.CreateDiscountRequestEntity = {
      name: `Adv Fixed Disc ${Date.now()}`.slice(0, 40),
      type: components.DiscountType.Fixed,
      amount: 2000,
      currency: "EUR",
      duration: components.CouponDurationType.Repeating,
      durationInMonths: 3,
      maxRedemptions: 100,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      appliesToProducts: [testProduct.id],
    };

    const result = await creem.discounts.create(advancedFixedDiscount);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("name", advancedFixedDiscount.name);
    expect(result).toHaveProperty("type", advancedFixedDiscount.type);
    expect(result).toHaveProperty("amount", advancedFixedDiscount.amount);
    expect(result).toHaveProperty("currency", advancedFixedDiscount.currency);
    expect(result).toHaveProperty("duration", advancedFixedDiscount.duration);
    expect(result).toHaveProperty(
      "durationInMonths",
      advancedFixedDiscount.durationInMonths
    );
    expect(result).toHaveProperty(
      "maxRedemptions",
      advancedFixedDiscount.maxRedemptions
    );
    expect(result).toHaveProperty("expiryDate");
  });

  it("should handle validation errors for fixed discounts", async () => {
    try {
      await creem.discounts.create({
        name: "Invalid Fixed Discount",
        type: components.DiscountType.Fixed,
        // Missing required amount and currency
      } as any);
      fail(
        "Expected error with invalid fixed discount data but none was thrown"
      );
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
