import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { getConvexErrorMessage } from "./convexError.js";

describe("getConvexErrorMessage", () => {
  it("reads message data from ConvexError", () => {
    expect(
      getConvexErrorMessage(
        new ConvexError({
          message: "Customer not found — complete a checkout first",
        }),
        "Unexpected error occurred",
      ),
    ).toBe("Customer not found — complete a checkout first");
  });

  it("supports string data from older ConvexError throws", () => {
    expect(
      getConvexErrorMessage(
        new ConvexError("Subscription not found"),
        "Unexpected error occurred",
      ),
    ).toBe("Subscription not found");
  });

  it("uses fallback for developer errors", () => {
    expect(
      getConvexErrorMessage(
        new Error("Internal implementation details"),
        "Unexpected error occurred",
      ),
    ).toBe("Unexpected error occurred");
  });
});
