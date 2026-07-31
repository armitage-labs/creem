import { describe, expect, it } from "vitest";
import {
  buildCatalogRegistrations,
  cyclesForGroup,
  deriveAvailableCycles,
  deriveGroupItems,
  deriveOwnProductIds,
  filterPlansByGroup,
  filterVisiblePlans,
  resolveActiveGroupId,
  resolveActiveOrScheduledPlanIds,
  resolveActivePlanId,
  resolveEffectiveCycle,
  resolveMatchedSubscription,
  resolveUIPlans,
} from "./subscriptionModel.js";
import { defineBillingCatalog } from "./catalog.js";
import type { ConnectedBillingModel, ConnectedProduct } from "./model.js";
import type { UIPlanEntry } from "./types.js";

const catalog = defineBillingCatalog({
  version: "test",
  plans: [
    {
      planId: "trial",
      category: "trial",
      billingType: "custom",
      eligibilityScopeId: "base",
      eligibility: { oncePerEntity: true, hideWhenIneligible: true },
    },
    { planId: "free", category: "free", billingType: "custom" },
    {
      planId: "basic",
      category: "paid",
      billingType: "recurring",
      creemProductIds: { "every-month": "prod_basic_m" },
    },
    {
      planId: "premium",
      category: "paid",
      billingType: "recurring",
      recommended: true,
      creemProductIds: {
        "every-month": "prod_premium_m",
        "every-year": "prod_premium_y",
      },
    },
  ],
} as const);

const products = [
  {
    id: "prod_basic_m",
    name: "Basic Monthly",
    description: "From Creem",
    price: 1000,
  },
  { id: "prod_premium_m", name: "Premium Monthly", price: 2000 },
] as unknown as ConnectedProduct[];

const emptyModel = (
  overrides: Partial<ConnectedBillingModel> = {},
): ConnectedBillingModel => ({
  user: { id: "u1", email: "a@b.com" },
  catalog,
  snapshot: null,
  allProducts: [],
  ownedProductIds: [],
  subscriptionProductId: null,
  appPlanActivations: [],
  appPlanAssignments: [],
  activeSubscriptions: [],
  scheduledSubscriptionUpdates: [],
  hasCreemCustomer: false,
  ...overrides,
});

const plansFor = (planIds: string[]): UIPlanEntry[] =>
  resolveUIPlans({
    registrations: buildCatalogRegistrations({ planIds }),
    catalog,
    products,
  });

describe("buildCatalogRegistrations", () => {
  it("maps plain plan IDs", () => {
    expect(buildCatalogRegistrations({ planIds: ["free", "basic"] })).toEqual([
      { planId: "free", groupId: undefined, groupTitle: undefined },
      { planId: "basic", groupId: undefined, groupTitle: undefined },
    ]);
  });

  it("carries group value and label onto each plan", () => {
    expect(
      buildCatalogRegistrations({
        groups: [
          { value: "teams", label: "Teams", plans: ["basic"] },
          { value: "solo", label: "Solo", plans: ["free"] },
        ],
        planIds: ["ignored"],
      }),
    ).toEqual([
      { planId: "basic", groupId: "teams", groupTitle: "Teams" },
      { planId: "free", groupId: "solo", groupTitle: "Solo" },
    ]);
  });
});

describe("resolveUIPlans", () => {
  it("resolves display fields from catalog then Creem product data", () => {
    const [basic] = plansFor(["basic"]);
    expect(basic.title).toBe("Basic Monthly");
    expect(basic.description).toBe("From Creem");
    expect(basic.billingCycles).toEqual(["every-month"]);
  });

  it("falls back to a capitalized plan ID when nothing else names the plan", () => {
    const [free] = plansFor(["free"]);
    expect(free.title).toBe("Free");
    expect(free.category).toBe("free");
  });

  it("preserves app-plan eligibility metadata", () => {
    const [trial] = plansFor(["trial"]);
    expect(trial.eligibilityScopeId).toBe("base");
    expect(trial.eligibility).toEqual({
      oncePerEntity: true,
      hideWhenIneligible: true,
    });
  });

  it("lets registration props win over catalog and product data", () => {
    const [plan] = resolveUIPlans({
      registrations: [
        { planId: "basic", title: "Custom", description: "Custom copy" },
      ],
      catalog,
      products,
    });
    expect(plan.title).toBe("Custom");
    expect(plan.description).toBe("Custom copy");
  });

  it("treats type=unit-based as unit pricing", () => {
    const [plan] = resolveUIPlans({
      registrations: [{ planId: "basic", type: "unit-based" }],
      catalog,
      products,
    });
    expect(plan.pricingModel).toBe("unit");
  });
});

describe("group derivation", () => {
  it("prefers explicit groups", () => {
    const groups = [{ value: "teams", label: "Teams", plans: ["basic"] }];
    expect(deriveGroupItems({ groups, plans: [] })).toEqual([
      { value: "teams", label: "Teams" },
    ]);
  });

  it("infers groups from plan groupIds with formatted labels", () => {
    const plans = [{ planId: "a", category: "paid", groupId: "power-users" }];
    expect(deriveGroupItems({ plans: plans as UIPlanEntry[] })).toEqual([
      { value: "power-users", label: "Power Users" },
    ]);
  });

  it("clamps an unknown requested group to the first one", () => {
    const groupItems = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    expect(
      resolveActiveGroupId({ groupItems, requestedGroupId: "missing" }),
    ).toBe("a");
    expect(resolveActiveGroupId({ groupItems, requestedGroupId: "b" })).toBe(
      "b",
    );
  });

  it("shows all plans when there is at most one group", () => {
    const plans = plansFor(["free", "basic"]);
    expect(
      filterPlansByGroup({ plans, groupItems: [], activeGroupId: null }),
    ).toHaveLength(2);
  });
});

describe("cycle derivation", () => {
  it("collects distinct cycles in first-seen order", () => {
    expect(deriveAvailableCycles(plansFor(["basic", "premium"]))).toEqual([
      "every-month",
      "every-year",
    ]);
  });

  it("clamps a requested cycle that no visible plan offers", () => {
    expect(
      resolveEffectiveCycle({
        availableCycles: ["every-month"],
        requestedCycle: "every-year",
      }),
    ).toBe("every-month");
  });

  it("keeps the requested cycle when nothing constrains it", () => {
    expect(
      resolveEffectiveCycle({
        availableCycles: [],
        requestedCycle: "every-year",
      }),
    ).toBe("every-year");
  });
});

describe("subscription matching", () => {
  it("collects every product ID owned by the rendered plans", () => {
    expect(deriveOwnProductIds(plansFor(["basic", "premium"]))).toEqual(
      new Set(["prod_basic_m", "prod_premium_m", "prod_premium_y"]),
    );
  });

  it("ignores subscriptions belonging to another root's products", () => {
    const model = emptyModel({
      activeSubscriptions: [
        {
          id: "sub_other",
          productId: "prod_addon",
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          currentPeriodStart: "2026-01-01",
          units: null,
          recurringInterval: "every-month",
        },
      ],
    });
    expect(
      resolveMatchedSubscription({
        model,
        ownProductIds: deriveOwnProductIds(plansFor(["basic"])),
      }),
    ).toBeNull();
  });

  it("matches a subscription on one of this root's products", () => {
    const model = emptyModel({
      activeSubscriptions: [
        {
          id: "sub_1",
          productId: "prod_basic_m",
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          currentPeriodStart: "2026-01-01",
          units: null,
          recurringInterval: "every-month",
        },
      ],
    });
    expect(
      resolveMatchedSubscription({
        model,
        ownProductIds: deriveOwnProductIds(plansFor(["basic"])),
      })?.id,
    ).toBe("sub_1");
  });
});

describe("resolveActivePlanId", () => {
  const plans = plansFor(["free", "basic", "premium"]);

  it("prefers the plan behind the active subscription", () => {
    expect(
      resolveActivePlanId({
        model: emptyModel(),
        plans,
        subscriptionProductId: "prod_premium_y",
      }),
    ).toBe("premium");
  });

  it("uses an explicit resolver override next", () => {
    expect(
      resolveActivePlanId({
        model: emptyModel({ activePlanId: "basic" }),
        plans,
        subscriptionProductId: null,
      }),
    ).toBe("basic");
  });

  it("falls back to an active app-plan assignment", () => {
    const model = emptyModel({
      appPlanAssignments: [
        {
          entityId: "e1",
          planId: "free",
          status: "active",
          startsAt: "2026-01-01",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });
    expect(
      resolveActivePlanId({ model, plans, subscriptionProductId: null }),
    ).toBe("free");
  });

  it("falls back to the first free plan for a signed-in user", () => {
    expect(
      resolveActivePlanId({
        model: emptyModel(),
        plans,
        subscriptionProductId: null,
      }),
    ).toBe("free");
  });

  it("falls back to the free plan when the model sends activePlanId: null", () => {
    // The shipped model ALWAYS sets this field — `getBillingModel` resolves
    // `activePlanId ?? activeFreePlanId ?? activeAssignedPlanId`, which is null
    // for a free-tier user with no assignment. Testing `!== undefined` here made
    // every later fallback unreachable in production while this suite passed,
    // because the fixture omitted the field entirely.
    expect(
      resolveActivePlanId({
        model: emptyModel({ activePlanId: null }),
        plans,
        subscriptionProductId: null,
      }),
    ).toBe("free");
  });

  it("still prefers an explicit activePlanId from the resolver", () => {
    expect(
      resolveActivePlanId({
        model: emptyModel({ activePlanId: "pro" }),
        plans,
        subscriptionProductId: null,
      }),
    ).toBe("pro");
  });

  it("returns null for an anonymous visitor", () => {
    expect(
      resolveActivePlanId({
        model: emptyModel({ user: null }),
        plans,
        subscriptionProductId: null,
      }),
    ).toBeNull();
  });
});

describe("resolveActiveOrScheduledPlanIds", () => {
  it("includes scheduled period-end targets", () => {
    const plans = plansFor(["free", "basic", "premium"]);
    const model = emptyModel({
      scheduledSubscriptionUpdates: [
        {
          entityId: "e1",
          subscriptionId: "sub_1",
          targetProductId: "prod_premium_m",
          effectiveAt: "2026-06-01",
          status: "pending",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });
    expect(
      resolveActiveOrScheduledPlanIds({
        model,
        plans,
        subscriptionProductId: "prod_basic_m",
      }).sort(),
    ).toEqual(["basic", "premium"]);
  });
});

describe("filterVisiblePlans", () => {
  it("hides a once-per-entity trial that was already activated", () => {
    const plans = plansFor(["trial", "free"]);
    const model = emptyModel({
      appPlanActivations: [
        {
          entityId: "e1",
          planId: "trial",
          firstActivatedAt: 1,
          lastActivatedAt: 1,
          activationCount: 1,
        },
      ],
    });
    const visible = filterVisiblePlans({
      groupedPlans: plans,
      allPlans: plans,
      model,
      activePlanId: "free",
      activeOrScheduledPlanIds: ["free"],
    });
    expect(visible.map((plan) => plan.planId)).toEqual(["free"]);
  });

  it("keeps the trial visible before it has been used", () => {
    const plans = plansFor(["trial", "free"]);
    const visible = filterVisiblePlans({
      groupedPlans: plans,
      allPlans: plans,
      model: emptyModel(),
      activePlanId: null,
      activeOrScheduledPlanIds: [],
    });
    expect(visible.map((plan) => plan.planId)).toEqual(["trial", "free"]);
  });
});

describe("cyclesForGroup", () => {
  it("excludes cycles that only an ineligible plan offers", () => {
    // The trial is once-per-entity and already used, so it must not contribute
    // an interval to the selector when switching into its group.
    const trialOnly = defineBillingCatalog({
      version: "test",
      plans: [
        {
          planId: "used-trial",
          category: "trial",
          billingType: "recurring",
          eligibility: { oncePerEntity: true, hideWhenIneligible: true },
          creemProductIds: { "every-year": "prod_trial_y" },
        },
        {
          planId: "paid",
          category: "paid",
          billingType: "recurring",
          creemProductIds: { "every-month": "prod_paid_m" },
        },
      ],
    } as const);

    const plans = resolveUIPlans({
      registrations: buildCatalogRegistrations({
        planIds: ["used-trial", "paid"],
      }),
      catalog: trialOnly,
      products: [],
    });

    const model = emptyModel({
      appPlanActivations: [
        {
          entityId: "e1",
          planId: "used-trial",
          firstActivatedAt: 1,
          lastActivatedAt: 1,
          activationCount: 1,
        },
      ],
    });

    expect(
      cyclesForGroup({
        plans,
        groupItems: [],
        groupId: null,
        model,
        activePlanId: "paid",
        activeOrScheduledPlanIds: ["paid"],
      }),
    ).toEqual(["every-month"]);
  });
});

describe("catalog-declared Creem trials", () => {
  const trialCatalog = defineBillingCatalog({
    version: "test",
    plans: [
      {
        planId: "basic",
        category: "paid",
        billingType: "recurring",
        trialDays: 14,
        creemProductIds: { "every-month": "prod_basic_m" },
      },
    ],
  } as const);

  it("carries trialDays from the catalog onto the resolved plan", () => {
    const [plan] = resolveUIPlans({
      registrations: buildCatalogRegistrations({ planIds: ["basic"] }),
      catalog: trialCatalog,
      products: [],
    });
    expect(plan.trialDays).toBe(14);
  });

  it("leaves trialDays undefined when the catalog does not declare one", () => {
    const [plan] = plansFor(["basic"]);
    expect(plan.trialDays).toBeUndefined();
  });
});
