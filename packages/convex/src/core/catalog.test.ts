import { describe, expect, it } from "vitest";
import {
  isSupportedRecurringCycle,
  normalizeRecurringCycle,
  normalizePlanCategory,
  normalizeBillingType,
  normalizePlanCatalog,
  findPlanById,
  findPlanByProductId,
} from "./catalog.js";

describe("isSupportedRecurringCycle", () => {
  it("returns true for every-month", () => {
    expect(isSupportedRecurringCycle("every-month")).toBe(true);
  });

  it("returns true for every-year", () => {
    expect(isSupportedRecurringCycle("every-year")).toBe(true);
  });

  it("returns false for unknown cycle", () => {
    expect(isSupportedRecurringCycle("weekly")).toBe(false);
  });
});

describe("normalizeRecurringCycle", () => {
  it("returns undefined for null", () => {
    expect(normalizeRecurringCycle(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizeRecurringCycle(undefined)).toBeUndefined();
  });

  it("returns the value for supported cycles", () => {
    expect(normalizeRecurringCycle("every-month")).toBe("every-month");
    expect(normalizeRecurringCycle("every-three-months")).toBe(
      "every-three-months",
    );
    expect(normalizeRecurringCycle("every-six-months")).toBe(
      "every-six-months",
    );
    expect(normalizeRecurringCycle("every-year")).toBe("every-year");
  });

  it("returns custom for unsupported cycles", () => {
    expect(normalizeRecurringCycle("weekly")).toBe("custom");
    expect(normalizeRecurringCycle("biweekly")).toBe("custom");
  });
});

describe("normalizePlanCategory", () => {
  it("returns custom for null", () => {
    expect(normalizePlanCategory(null)).toBe("custom");
  });

  it("returns custom for undefined", () => {
    expect(normalizePlanCategory(undefined)).toBe("custom");
  });

  it("returns the value for known categories", () => {
    expect(normalizePlanCategory("free")).toBe("free");
    expect(normalizePlanCategory("trial")).toBe("trial");
    expect(normalizePlanCategory("paid")).toBe("paid");
    expect(normalizePlanCategory("enterprise")).toBe("enterprise");
    expect(normalizePlanCategory("custom")).toBe("custom");
  });

  it("returns custom for unknown values", () => {
    expect(normalizePlanCategory("premium")).toBe("custom");
    expect(normalizePlanCategory("vip")).toBe("custom");
  });
});

describe("normalizeBillingType", () => {
  it("returns custom for null", () => {
    expect(normalizeBillingType(null)).toBe("custom");
  });

  it("returns custom for undefined", () => {
    expect(normalizeBillingType(undefined)).toBe("custom");
  });

  it("returns the value for known types", () => {
    expect(normalizeBillingType("recurring")).toBe("recurring");
    expect(normalizeBillingType("onetime")).toBe("onetime");
    expect(normalizeBillingType("custom")).toBe("custom");
  });

  it("returns custom for unknown values", () => {
    expect(normalizeBillingType("metered")).toBe("custom");
  });
});

describe("normalizePlanCatalog", () => {
  it("returns undefined for null", () => {
    expect(normalizePlanCatalog(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(normalizePlanCatalog(undefined)).toBeUndefined();
  });

  it("normalizes plan entries", () => {
    const catalog = normalizePlanCatalog({
      version: "1",
      plans: [
        {
          planId: "pro",
          category: "paid",
          billingType: "recurring",
          billingCycles: ["every-month", "every-year"],
        },
        {
          planId: "custom",
          category: "unknown_category" as any,
          billingType: "unknown_type" as any,
          billingCycles: ["every-month", "biweekly" as any],
        },
      ],
    });
    expect(catalog).toBeDefined();
    expect(catalog!.plans[0].category).toBe("paid");
    expect(catalog!.plans[0].billingType).toBe("recurring");
    expect(catalog!.plans[0].billingCycles).toEqual([
      "every-month",
      "every-year",
    ]);
    // Unknown values normalize to "custom"
    expect(catalog!.plans[1].category).toBe("custom");
    expect(catalog!.plans[1].billingType).toBe("custom");
    expect(catalog!.plans[1].billingCycles).toEqual(["every-month", "custom"]);
  });

  it("filters out null cycles from normalization", () => {
    const catalog = normalizePlanCatalog({
      version: "1",
      plans: [
        {
          planId: "test",
          category: "paid",
          billingCycles: [null as any, "every-month"],
        },
      ],
    });
    // null normalizes to undefined which gets filtered out
    expect(catalog!.plans[0].billingCycles).toEqual(["every-month"]);
  });
});

describe("findPlanById", () => {
  const catalog = {
    version: "1",
    plans: [
      { planId: "free", category: "free" as const },
      { planId: "pro", category: "paid" as const },
    ],
  };

  it("finds a plan by id", () => {
    expect(findPlanById(catalog, "pro")).toEqual({
      planId: "pro",
      category: "paid",
    });
  });

  it("returns undefined for unknown id", () => {
    expect(findPlanById(catalog, "enterprise")).toBeUndefined();
  });

  it("returns undefined for undefined catalog", () => {
    expect(findPlanById(undefined, "pro")).toBeUndefined();
  });
});

describe("findPlanByProductId", () => {
  const catalog = {
    version: "1",
    plans: [
      {
        planId: "pro",
        category: "paid" as const,
        creemProductIds: {
          "every-month": "prod_1",
          "every-year": "prod_2",
        } as Record<string, string>,
      },
      {
        planId: "basic",
        category: "paid" as const,
        creemProductIds: { "every-month": "prod_3" } as Record<string, string>,
      },
    ],
  };

  it("finds plan by product id", () => {
    expect(findPlanByProductId(catalog, "prod_2")?.planId).toBe("pro");
    expect(findPlanByProductId(catalog, "prod_3")?.planId).toBe("basic");
  });

  it("returns undefined for unknown product id", () => {
    expect(findPlanByProductId(catalog, "prod_unknown")).toBeUndefined();
  });

  it("returns undefined for undefined catalog", () => {
    expect(findPlanByProductId(undefined, "prod_1")).toBeUndefined();
  });

  it("returns undefined for undefined productId", () => {
    expect(findPlanByProductId(catalog, undefined)).toBeUndefined();
  });
});
