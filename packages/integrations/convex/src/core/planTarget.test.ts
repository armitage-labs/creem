import { describe, expect, it } from "vitest";
import type { PlanCatalogEntry } from "./types.js";
import { resolvePlanTarget } from "./planTarget.js";

const plan = (
  category: PlanCatalogEntry["category"],
  overrides: Partial<PlanCatalogEntry> = {},
): PlanCatalogEntry => ({
  planId: category,
  category,
  ...overrides,
});

describe("resolvePlanTarget", () => {
  it.each([
    plan("free"),
    plan("trial"),
    plan("custom"),
    plan("paid", { billingType: "custom" }),
  ])("routes app-owned $category plans through app activation", (entry) => {
    expect(resolvePlanTarget(entry, "prod_ignored")).toEqual({
      kind: "app-plan",
      appPlanId: entry.planId,
    });
  });

  it("routes enterprise plans to sales even if a product ID is present", () => {
    expect(
      resolvePlanTarget(
        plan("enterprise", { contactUrl: "https://example.com/sales" }),
        "prod_enterprise",
      ),
    ).toEqual({
      kind: "contact-sales",
      contactUrl: "https://example.com/sales",
    });
  });

  it("routes Creem-backed plans to their resolved product", () => {
    expect(resolvePlanTarget(plan("paid"), "prod_pro")).toEqual({
      kind: "creem-product",
      productId: "prod_pro",
    });
  });

  it("marks a commerce plan without a resolved product as unconfigured", () => {
    expect(resolvePlanTarget(plan("paid"))).toEqual({
      kind: "unconfigured",
    });
  });
});
