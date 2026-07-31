import { describe, expect, it } from "vitest";
import {
  isSupportedRecurringCycle,
  normalizeRecurringCycle,
  normalizePlanCategory,
  normalizeBillingType,
  normalizePlanCatalog,
  mergePlanCatalogs,
  defineBillingCatalog,
  plansOf,
  findPlanById,
  findPlanByProductId,
  findCreditGrantByProductId,
  hasAppPlanActivation,
  isAppOwnedPlan,
  isAppPlanEligible,
  resolvePlanProductId,
  shouldShowPlan,
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

  it("normalizes products to creemProductIds", () => {
    const catalog = normalizePlanCatalog(
      defineBillingCatalog({
        version: "1",
        plans: [
          {
            planId: "team",
            category: "paid",
            products: {
              "every-month": {
                productSlug: "team-monthly",
                productId: "prod_team_monthly",
              },
            },
          },
        ],
      } as const),
    );

    expect(catalog?.plans[0].creemProductIds).toEqual({
      "every-month": "prod_team_monthly",
    });
  });
});

describe("plansOf", () => {
  it("returns plan IDs unchanged", () => {
    const catalog = defineBillingCatalog({
      version: "1",
      plans: [{ planId: "pro", category: "paid" }],
    } as const);

    expect(plansOf(catalog, ["pro"] as const)).toEqual(["pro"]);
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

describe("findCreditGrantByProductId", () => {
  it("finds the credit grant configured for a product", () => {
    const catalog = {
      version: "1",
      plans: [
        {
          planId: "credits",
          category: "paid" as const,
          billingType: "onetime" as const,
          creemProductIds: { custom: "prod_credits" },
          creditGrant: {
            amount: "100",
            refundBehavior: "revoke_on_full_refund" as const,
          },
        },
      ],
    };

    expect(findCreditGrantByProductId(catalog, "prod_credits")).toEqual({
      amount: "100",
      refundBehavior: "revoke_on_full_refund",
    });
  });

  it("returns undefined when the product has no credit grant", () => {
    const catalog = {
      version: "1",
      plans: [
        {
          planId: "license",
          category: "paid" as const,
          billingType: "onetime" as const,
          creemProductIds: { custom: "prod_license" },
        },
      ],
    };

    expect(findCreditGrantByProductId(catalog, "prod_license")).toBeUndefined();
  });
});

describe("app-owned plan eligibility", () => {
  const trialPlan = {
    planId: "trial",
    category: "trial" as const,
    billingType: "custom" as const,
    eligibilityScopeId: "base",
    eligibility: {
      oncePerEntity: true,
      hideWhenIneligible: true,
    },
  };

  it("detects app-owned plans", () => {
    expect(isAppOwnedPlan(trialPlan)).toBe(true);
    expect(
      isAppOwnedPlan({
        planId: "pro",
        category: "paid",
        billingType: "recurring",
      }),
    ).toBe(false);
  });

  it("keeps a once-per-entity plan eligible until it was activated", () => {
    expect(isAppPlanEligible(trialPlan, [], { activePlanId: "free" })).toBe(
      true,
    );
    expect(
      isAppPlanEligible(
        trialPlan,
        [
          {
            entityId: "org_1",
            planId: "trial",
            firstActivatedAt: 1,
            lastActivatedAt: 1,
            activationCount: 1,
          },
        ],
        { activePlanId: "free" },
      ),
    ).toBe(false);
  });

  it("hides a scoped trial when a non-trial plan in the same scope is active or scheduled", () => {
    const freePlan = {
      planId: "free",
      category: "free" as const,
      billingType: "custom" as const,
      eligibilityScopeId: "base",
    };
    const addonPlan = {
      planId: "addon",
      category: "paid" as const,
      billingType: "recurring" as const,
      eligibilityScopeId: "addon",
    };
    const scopedTrialPlan = {
      ...trialPlan,
      eligibility: {
        ...trialPlan.eligibility,
        expiresWhenScopeHasNonTrialPlan: true,
      },
    };

    expect(
      shouldShowPlan(scopedTrialPlan, [], {
        activeOrScheduledPlanIds: ["free"],
        catalogPlans: [scopedTrialPlan, freePlan, addonPlan],
      }),
    ).toBe(false);
    expect(
      shouldShowPlan(scopedTrialPlan, [], {
        activeOrScheduledPlanIds: ["addon"],
        catalogPlans: [scopedTrialPlan, freePlan, addonPlan],
      }),
    ).toBe(true);
  });

  it("does not expire scoped trials from the implicit current plan fallback", () => {
    const scopedTrialPlan = {
      ...trialPlan,
      eligibility: {
        ...trialPlan.eligibility,
        expiresWhenScopeHasNonTrialPlan: true,
      },
    };

    expect(
      shouldShowPlan(scopedTrialPlan, [], {
        activePlanId: "free",
        activeOrScheduledPlanIds: [],
        catalogPlans: [
          scopedTrialPlan,
          {
            planId: "free",
            category: "free" as const,
            eligibilityScopeId: "base",
          },
        ],
      }),
    ).toBe(true);
  });

  it("shows the active plan even when it was already activated", () => {
    const activations = [
      {
        entityId: "org_1",
        planId: "trial",
        firstActivatedAt: 1,
        lastActivatedAt: 1,
        activationCount: 1,
      },
    ];
    expect(
      isAppPlanEligible(trialPlan, activations, { activePlanId: "trial" }),
    ).toBe(true);
    expect(
      shouldShowPlan(trialPlan, activations, { activePlanId: "trial" }),
    ).toBe(true);
  });

  it("hides ineligible plans only when configured", () => {
    const activations = [
      {
        entityId: "org_1",
        planId: "trial",
        firstActivatedAt: 1,
        lastActivatedAt: 1,
        activationCount: 1,
      },
    ];
    expect(hasAppPlanActivation(activations, "trial")).toBe(true);
    expect(
      shouldShowPlan(trialPlan, activations, { activePlanId: "free" }),
    ).toBe(false);
    expect(
      shouldShowPlan(
        {
          ...trialPlan,
          eligibility: { oncePerEntity: true },
        },
        activations,
        { activePlanId: "free" },
      ),
    ).toBe(true);
  });
});

describe("resolvePlanProductId", () => {
  const catalog = normalizePlanCatalog({
    version: "1",
    plans: [
      {
        planId: "pro",
        category: "paid",
        products: {
          "every-month": "prod_monthly",
        },
      },
    ],
  });

  it("resolves a product ID by plan and cycle", () => {
    expect(resolvePlanProductId(catalog, "pro", "every-month")).toBe(
      "prod_monthly",
    );
  });

  it("throws a clear error for unknown plans", () => {
    expect(() =>
      resolvePlanProductId(catalog, "missing", "every-month"),
    ).toThrow('Unknown billing plan "missing"');
  });

  it("throws a clear error for unavailable cycles", () => {
    expect(() => resolvePlanProductId(catalog, "pro", "every-year")).toThrow(
      'Billing plan "pro" has no product for "every-year"',
    );
  });
});

describe("mergePlanCatalogs", () => {
  const serverCatalog = {
    version: "server",
    plans: [
      {
        planId: "pro",
        category: "paid" as const,
        title: "Pro",
        creemProductIds: { "every-month": "prod_pro_m" },
      },
    ],
  };

  it("returns undefined when nothing is provided", () => {
    expect(mergePlanCatalogs(undefined, null)).toBeUndefined();
  });

  it("uses the server catalog when the app configures none", () => {
    // The server publishes its catalog on `ConnectedBillingModel.catalog`.
    // Dropping it leaves cards with no price and a dead CTA.
    const merged = mergePlanCatalogs(serverCatalog, undefined, undefined);
    expect(merged?.plans[0].creemProductIds).toEqual({
      "every-month": "prod_pro_m",
    });
  });

  it("lets a later catalog override fields without losing product mappings", () => {
    const merged = mergePlanCatalogs(serverCatalog, undefined, {
      version: "local",
      plans: [
        { planId: "pro", category: "paid" as const, title: "Pro (renamed)" },
      ],
    });
    expect(merged?.plans[0].title).toBe("Pro (renamed)");
    // The override only set a title; the server's product IDs must survive.
    expect(merged?.plans[0].creemProductIds).toEqual({
      "every-month": "prod_pro_m",
    });
    expect(merged?.version).toBe("local");
  });

  it("lets a later catalog replace product mappings when it supplies them", () => {
    const merged = mergePlanCatalogs(serverCatalog, undefined, {
      version: "local",
      plans: [
        {
          planId: "pro",
          category: "paid" as const,
          creemProductIds: { "every-month": "prod_override" },
        },
      ],
    });
    expect(merged?.plans[0].creemProductIds).toEqual({
      "every-month": "prod_override",
    });
  });

  it("keeps first-appearance plan order and appends new plans", () => {
    const merged = mergePlanCatalogs(serverCatalog, undefined, {
      version: "local",
      plans: [
        { planId: "starter", category: "paid" as const },
        { planId: "pro", category: "paid" as const },
      ],
    });
    expect(merged?.plans.map((p) => p.planId)).toEqual(["pro", "starter"]);
  });
});
