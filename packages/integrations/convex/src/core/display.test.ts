import { describe, expect, it } from "vitest";
import { formatIntervalSuffix, resolveProductIdForPlan } from "./display.js";
import type { UIPlanEntry } from "./types.js";

describe("display helpers", () => {
  it("resolves product IDs only from canonical catalog cycle keys", () => {
    const plan: UIPlanEntry = {
      planId: "pro",
      category: "paid",
      creemProductIds: {
        "every-month": "prod_month",
        monthly: "prod_alias",
      },
    };

    expect(resolveProductIdForPlan(plan, "every-month")).toBe("prod_month");
    expect(resolveProductIdForPlan(plan, "every-year")).toBe("prod_month");
  });

  it("formats interval suffixes only for canonical Creem intervals", () => {
    expect(formatIntervalSuffix("every-month")).toBe("/mo");
    expect(formatIntervalSuffix("monthly")).toBe("");
    expect(formatIntervalSuffix("annual")).toBe("");
  });
});
