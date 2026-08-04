/**
 * Billing catalog shared by the React and Svelte examples.
 *
 * Both demos run against the same Convex deployment and the same Creem store,
 * so they read one catalog. A real app defines this once in
 * `src/billingCatalog.ts` and imports it from its pages; see the quickstart.
 *
 * Imported from `@creem_io/convex/core`: the framework-neutral entry that also
 * stays out of the browser bundle. The root entry is the *server* client — it
 * pulls in the Creem Node SDK and the whole webhook/API surface, which both
 * Vite apps would otherwise ship to the browser just to get this one helper.
 */
import { defineBillingCatalog } from "@creem_io/convex/core";

/** Product IDs live in `packages/convex/.env.local`, read by both Vite apps. */
export const env = {
  // Subscription products — multi-cycle
  subBasicMonthly: import.meta.env.VITE_CREEM_SUB_BASIC_MONTHLY as string,
  subBasicQuarterly: import.meta.env.VITE_CREEM_SUB_BASIC_QUARTERLY as string,
  subBasicSemiAnnual: import.meta.env
    .VITE_CREEM_SUB_BASIC_SEMI_ANNUAL as string,
  subBasicAnnual: import.meta.env.VITE_CREEM_SUB_BASIC_ANNUAL as string,
  subPremiumMonthly: import.meta.env.VITE_CREEM_SUB_PREMIUM_MONTHLY as string,
  subPremiumQuarterly: import.meta.env
    .VITE_CREEM_SUB_PREMIUM_QUARTERLY as string,
  subPremiumSemiAnnual: import.meta.env
    .VITE_CREEM_SUB_PREMIUM_SEMI_ANNUAL as string,
  subPremiumAnnual: import.meta.env.VITE_CREEM_SUB_PREMIUM_ANNUAL as string,
  // Subscription products — monthly only (simple variant)
  subSimpleBasicMonthly: import.meta.env
    .VITE_CREEM_SUB_SIMPLE_BASIC_MONTHLY as string,
  subSimpleProMonthly: import.meta.env
    .VITE_CREEM_SUB_SIMPLE_PRO_MONTHLY as string,
  // Unit-based subscription products
  subUnitBasicMonthly: import.meta.env
    .VITE_CREEM_SUB_UNIT_BASIC_MONTHLY as string,
  subUnitPremiumMonthly: import.meta.env
    .VITE_CREEM_SUB_UNIT_PREMIUM_MONTHLY as string,
  // Subscription products — monthly only (period-end scheduled update demo)
  subPeriodEndBasicMonthly: import.meta.env
    .VITE_CREEM_SUB_PERIOD_END_BASIC_MONTHLY as string,
  subPeriodEndPremiumMonthly: import.meta.env
    .VITE_CREEM_SUB_PERIOD_END_PREMIUM_MONTHLY as string,
  // One-time product IDs
  onetimeSingle: import.meta.env.VITE_CREEM_ONETIME_SINGLE as string,
  onetimeBasic: import.meta.env.VITE_CREEM_ONETIME_BASIC as string,
  onetimePremium: import.meta.env.VITE_CREEM_ONETIME_PREMIUM as string,
  onetimeUpgradeDelta: import.meta.env
    .VITE_CREEM_ONETIME_UPGRADE_DELTA as string,
  onetimeCredits: import.meta.env.VITE_CREEM_ONETIME_CREDITS as string,
};

/**
 * Trial length configured on the multi-cycle Creem products, in days.
 *
 * Creem does not expose trial configuration on the product API, so the catalog
 * mirrors what the dashboard has. Change one and change the other.
 */
export const CREEM_TRIAL_DAYS = 7;

export const billingCatalog = defineBillingCatalog({
  version: "example",
  defaultPlanId: "free",
  plans: [
    {
      planId: "trial",
      category: "trial",
      billingType: "custom",
      eligibilityScopeId: "base",
      title: "Starter Trial",
      description:
        "No-card app trial. Hidden after it has been used once or a base plan is chosen.",
      eligibility: {
        oncePerEntity: true,
        hideWhenIneligible: true,
        expiresWhenScopeHasNonTrialPlan: true,
      },
      limits: { aiMessages: 5, projects: 1 },
    },
    {
      planId: "free",
      category: "free",
      billingType: "custom",
      eligibilityScopeId: "base",
      title: "Free",
      description: "For individuals getting started",
      limits: { aiMessages: 50, projects: 1 },
    },
    {
      planId: "pro",
      category: "paid",
      billingType: "recurring",
      title: "Pro",
      description: "One paid subscription with the default card UI",
      recommended: true,
      limits: { aiMessages: 1000, projects: 25 },
      creemProductIds: {
        "every-month": env.subSimpleProMonthly,
      },
    },
    {
      planId: "basic",
      category: "paid",
      billingType: "recurring",
      title: "Basic",
      description: "Core subscription features for small projects",
      limits: { aiMessages: 250, projects: 5 },
      creemProductIds: {
        "every-month": env.subSimpleBasicMonthly,
      },
    },
    {
      planId: "premium",
      category: "paid",
      billingType: "recurring",
      title: "Premium",
      description: "Advanced subscription features with priority support",
      recommended: true,
      limits: { aiMessages: 2500, projects: 100 },
      creemProductIds: {
        "every-month": env.subSimpleProMonthly,
      },
    },
    {
      planId: "basic-multi-cycle",
      category: "paid",
      billingType: "recurring",
      title: "Basic",
      description: "✔ Up to 10 projects\n✔ 5 GB storage\n✔ Email support",
      // Mirrors the trial configured on these products in the Creem dashboard.
      trialDays: CREEM_TRIAL_DAYS,
      creemProductIds: {
        "every-month": env.subBasicMonthly,
        "every-three-months": env.subBasicQuarterly,
        "every-six-months": env.subBasicSemiAnnual,
        "every-year": env.subBasicAnnual,
      },
    },
    {
      planId: "premium-multi-cycle",
      category: "paid",
      billingType: "recurring",
      title: "Premium",
      description: "✔ Unlimited projects\n✔ 100 GB storage\n✔ Priority support",
      recommended: true,
      // Mirrors the trial configured on these products in the Creem dashboard.
      trialDays: CREEM_TRIAL_DAYS,
      creemProductIds: {
        "every-month": env.subPremiumMonthly,
        "every-three-months": env.subPremiumQuarterly,
        "every-six-months": env.subPremiumSemiAnnual,
        "every-year": env.subPremiumAnnual,
      },
    },
    {
      planId: "enterprise",
      category: "enterprise",
      title: "Enterprise",
      description: "✔ SSO & SAML\n✔ Dedicated account manager\n✔ 99.9% SLA",
      contactUrl: "https://creem.io",
    },
    {
      planId: "basic-individual",
      category: "paid",
      billingType: "recurring",
      title: "Basic",
      description: "Personal workspace and basic support",
      groupId: "individual",
      groupTitle: "Individual",
      creemProductIds: {
        "every-month": env.subSimpleBasicMonthly,
      },
    },
    {
      planId: "premium-individual",
      category: "paid",
      billingType: "recurring",
      title: "Premium",
      description: "Unlimited personal projects and priority support",
      groupId: "individual",
      groupTitle: "Individual",
      recommended: true,
      creemProductIds: {
        "every-month": env.subSimpleProMonthly,
      },
    },
    {
      planId: "basic-team",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Basic",
      description: "Shared team workspace with unit-based billing",
      groupId: "teams",
      groupTitle: "Teams",
      creemProductIds: {
        "every-month": env.subUnitBasicMonthly,
      },
    },
    {
      planId: "premium-team",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Premium",
      description: "Advanced team controls with unit-based billing",
      groupId: "teams",
      groupTitle: "Teams",
      recommended: true,
      creemProductIds: {
        "every-month": env.subUnitPremiumMonthly,
      },
    },
    {
      planId: "basic-unit-auto",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Basic",
      description: "Units resolved from the subscription, no picker",
      creemProductIds: {
        "every-month": env.subUnitBasicMonthly,
      },
    },
    {
      planId: "premium-unit-auto",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Premium",
      description: "Units resolved from the subscription, no picker",
      recommended: true,
      creemProductIds: {
        "every-month": env.subUnitPremiumMonthly,
      },
    },
    {
      planId: "basic-individual-cycle",
      category: "paid",
      billingType: "recurring",
      title: "Basic Individual",
      groupId: "individual-cycle",
      groupTitle: "Individual",
      creemProductIds: {
        "every-month": env.subBasicMonthly,
        "every-three-months": env.subBasicQuarterly,
        "every-six-months": env.subBasicSemiAnnual,
        "every-year": env.subBasicAnnual,
      },
    },
    {
      planId: "premium-individual-cycle",
      category: "paid",
      billingType: "recurring",
      title: "Premium Individual",
      groupId: "individual-cycle",
      groupTitle: "Individual",
      recommended: true,
      creemProductIds: {
        "every-month": env.subPremiumMonthly,
        "every-three-months": env.subPremiumQuarterly,
        "every-six-months": env.subPremiumSemiAnnual,
        "every-year": env.subPremiumAnnual,
      },
    },
    {
      planId: "basic-team-cycle",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Basic",
      groupId: "teams-cycle",
      groupTitle: "Teams",
      creemProductIds: {
        "every-month": env.subUnitBasicMonthly,
        "every-year": env.subUnitBasicMonthly,
      },
    },
    {
      planId: "premium-team-cycle",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Premium",
      groupId: "teams-cycle",
      groupTitle: "Teams",
      recommended: true,
      creemProductIds: {
        "every-month": env.subUnitPremiumMonthly,
        "every-year": env.subUnitPremiumMonthly,
      },
    },
    {
      planId: "period-end-free",
      category: "free",
      title: "Free",
      description: "App-owned free plan for period-end downgrade testing",
    },
    {
      planId: "period-end-basic",
      category: "paid",
      billingType: "recurring",
      title: "Period Basic",
      description: "Dedicated basic plan for scheduled update testing",
      creemProductIds: {
        "every-month": env.subPeriodEndBasicMonthly,
      },
    },
    {
      planId: "period-end-premium",
      category: "paid",
      billingType: "recurring",
      title: "Period Premium",
      description: "Dedicated premium plan for scheduled update testing",
      recommended: true,
      creemProductIds: {
        "every-month": env.subPeriodEndPremiumMonthly,
      },
    },
    {
      planId: "ai-credits-100",
      category: "paid",
      billingType: "onetime",
      title: "100 AI Credits",
      description: "Repeatable prepaid credit pack",
      creemProductIds: {
        custom: env.onetimeCredits,
      },
      creditGrant: {
        amount: "100",
        accountName: "credits",
        unitLabel: "credits",
        refundBehavior: "revoke_on_full_refund",
      },
    },
  ],
} as const);
