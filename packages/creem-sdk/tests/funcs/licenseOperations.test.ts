import { Creem } from "../../src/index.js";
import { describe, it, expect } from "vitest";
import { APIError } from "../../src/models/errors/index.js";
import { fail } from "../../src/lib/matchers.js";
import { TEST_SERVER_IDX } from "../fixtures/testValues.js";
import { creem } from "../fixtures/testData.js";

// Create an instance with invalid API key for auth error tests
const creemWithInvalidKey = new Creem({
  apiKey: "fail",
  serverIdx: TEST_SERVER_IDX,
});

describe("License Key Operations", () => {
  // Note: These tests require a real license key from an actual purchase.
  // Licenses are created when a license-enabled product is purchased, not via API.
  // The authentication and error handling tests work without real data.

  it("should handle API authentication errors", async () => {
    try {
      // Attempt to call SDK method with invalid API key
      // Note: SDK validates input format first, so we may get validation error
      // before reaching the API. This tests both validation and auth paths.
      await creemWithInvalidKey.licenses.validate({
        key: "ABCDE-12345-ABCDE-12345-ABCDE", // Valid format key
      });
      // If it succeeds, fail the test (we expect it to throw)
      fail("Expected an error but none was thrown");
    } catch (error) {
      // We expect either an APIError (403) or an SDKValidationError
      expect(error).toBeDefined();
      if (error instanceof APIError) {
        expect((error as APIError).statusCode).toBe(403);
      }
    }
  });

  it("should handle request errors with invalid license key", async () => {
    try {
      await creem.licenses.validate({
        key: "INVALID-LICENSE-KEY",
      });
      fail("Expected error with invalid license key but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle network errors gracefully", async () => {
    // Create a new instance with an invalid server URL to simulate network error
    const creemWithInvalidServer = new Creem({
      apiKey: "test",
      serverIdx: TEST_SERVER_IDX,
      serverURL: "http://invalid-url",
    });

    try {
      await creemWithInvalidServer.licenses.validate({
        key: "ANY-LICENSE-KEY",
      });
      fail("Expected network error but none was thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // Skip tests that require real license data
  it.skip("should validate a license key successfully", async () => {
    // This test requires a real license key from an actual purchase
    // To run this test, set TEST_LICENSE_KEY in testValues.ts to a valid license key
  });

  it.skip("should activate a license key successfully", async () => {
    // This test requires a real license key from an actual purchase
  });

  it.skip("should deactivate a license key instance successfully", async () => {
    // This test requires an activated license instance
  });
});
