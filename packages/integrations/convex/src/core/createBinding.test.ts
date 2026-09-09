import { describe, it, expect } from "vitest";
import { createCreemReact } from "../react/createCreemReact.js";
import { createCreemSvelte } from "../svelte/createCreemSvelte.js";
import type { PlanCatalog } from "./types.js";

// Use a fake API reference shape — we only test the binding logic, not Convex runtime
const fakeApi = {
  uiModel: {} as any,
  checkouts: { create: {} as any },
  subscriptions: {
    update: {} as any,
    cancel: {} as any,
    resume: {} as any,
  },
};

const catalog = {
  version: "2",
  defaultPlanId: "free",
  plans: [
    { planId: "free", category: "free" as const },
    {
      planId: "pro",
      category: "paid" as const,
      billingCycles: ["every-month" as const, "every-year" as const],
      creemProductIds: {
        "every-month": "prod_m",
        "every-year": "prod_y",
      },
    },
    {
      planId: "enterprise",
      category: "enterprise" as const,
      contactUrl: "https://example.com",
    },
  ],
} satisfies PlanCatalog;

describe("createCreemReact", () => {
  it("returns typed planIds", () => {
    const binding = createCreemReact({ catalog, api: fakeApi });
    expect(binding.planIds).toEqual(["free", "pro", "enterprise"]);
  });

  it("isPlanId returns true for valid IDs", () => {
    const binding = createCreemReact({ catalog, api: fakeApi });
    expect(binding.isPlanId("pro")).toBe(true);
    expect(binding.isPlanId("nonexistent")).toBe(false);
  });

  it("uses default cycle when not specified", () => {
    const binding = createCreemReact({ catalog, api: fakeApi });
    expect(binding.defaultCycle).toBe("every-month");
  });

  it("uses custom default cycle", () => {
    const binding = createCreemReact({
      catalog,
      api: fakeApi,
      defaultCycle: "every-year",
    });
    expect(binding.defaultCycle).toBe("every-year");
  });

  it("passes the catalog and api through unchanged", () => {
    const binding = createCreemReact({ catalog, api: fakeApi });
    expect(binding.catalog).toBe(catalog);
    expect(binding.api).toBe(fakeApi);
  });

  it("is spreadable onto the provider", () => {
    const binding = createCreemReact({ catalog, api: fakeApi });
    expect(Object.keys({ ...binding }).sort()).toEqual([
      "api",
      "catalog",
      "defaultCycle",
      "isPlanId",
      "planIds",
    ]);
  });
});

describe("createCreemSvelte", () => {
  it("returns typed planIds", () => {
    const binding = createCreemSvelte({ catalog, api: fakeApi });
    expect(binding.planIds).toEqual(["free", "pro", "enterprise"]);
  });

  it("isPlanId returns true for valid IDs", () => {
    const binding = createCreemSvelte({ catalog, api: fakeApi });
    expect(binding.isPlanId("enterprise")).toBe(true);
    expect(binding.isPlanId("missing")).toBe(false);
  });

  it("preserves API references", () => {
    const binding = createCreemSvelte({ catalog, api: fakeApi });
    expect(binding.api).toBe(fakeApi);
  });
});
