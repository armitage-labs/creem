import {
  BillingGate,
  CheckoutSuccessSummary,
  BillingHistory,
  BillingPortal,
  CreemConvexProvider,
  Credits,
  Product,
  Subscription,
  defineBillingCatalog,
  evaluateUsageLimits,
  plansOf,
  selectBaseSubscription,
  getConvexErrorMessage,
  connectCreemApi,
  type ConnectedBillingApi,
  type ConnectedBillingModel,
  type Transition,
} from "@creem_io/convex/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import creemLogoUrl from "./assets/creem.svg";
import convexLogoUrl from "./assets/convex.svg";
import { CheckIcon, CopyIcon, GithubIcon } from "lucide-react";

const TEST_CARDS = [
  { number: "4111 1111 1111 1111", behavior: "Successful payment" },
  { number: "4507 9900 0000 0028", behavior: "Card declined" },
  { number: "4507 9900 0000 0010", behavior: "Insufficient funds" },
  { number: "4507 9900 0000 0044", behavior: "Incorrect CVC" },
];

function TestCardChip({
  number,
  behavior,
}: {
  number: string;
  behavior: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        title={`Copy card number (${behavior.toLowerCase()})`}
        onClick={() => {
          void navigator.clipboard.writeText(number);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1.5 rounded bg-surface-200-800 px-1.5 py-0.5 font-mono text-xs hover:bg-surface-300-700"
      >
        <span>{number}</span>
        {copied ? (
          <CheckIcon className="size-3 text-emerald-600" />
        ) : (
          <CopyIcon className="size-3 opacity-60" />
        )}
      </button>
      <span className="text-foreground-placeholder">{behavior}</span>
    </span>
  );
}

// One call maps every generated `convex/billing.ts` export onto the widget API.
// Exports you leave out simply hide the matching controls, and a wrong or
// missing export is a compile error rather than a runtime surprise.
const connectedApi: ConnectedBillingApi = connectCreemApi(api.billing);

const billingCatalog = defineBillingCatalog({
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
      planId: "basic-individual",
      category: "paid",
      billingType: "recurring",
      title: "Basic",
      description: "Personal workspace and basic support",
      limits: { aiMessages: 250, projects: 5 },
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_BASIC_INDIVIDUAL_MONTHLY_PRODUCT_ID ??
          "prod_1c6ZGcxekHKrVYuWriHs68",
      },
    },
    {
      planId: "premium-individual",
      category: "paid",
      billingType: "recurring",
      title: "Premium",
      description: "Unlimited personal projects and priority support",
      recommended: true,
      limits: { aiMessages: 2500, projects: 100 },
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_PREMIUM_INDIVIDUAL_MONTHLY_PRODUCT_ID ??
          "prod_3861b06bJDnvpEBcs2uxYv",
      },
    },
    {
      planId: "basic-team",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Basic",
      description: "Shared team workspace with unit-based billing",
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_BASIC_TEAM_MONTHLY_PRODUCT_ID ??
          "prod_1c6ZGcxekHKrVYuWriHs68",
      },
    },
    {
      planId: "premium-team",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      title: "Team Premium",
      description: "Advanced team controls with unit-based billing",
      recommended: true,
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_PREMIUM_TEAM_MONTHLY_PRODUCT_ID ??
          "prod_3861b06bJDnvpEBcs2uxYv",
      },
    },
    {
      planId: "basic-unit-auto",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_BASIC_UNIT_AUTO_MONTHLY_PRODUCT_ID ??
          "prod_1c6ZGcxekHKrVYuWriHs68",
      },
    },
    {
      planId: "premium-unit-auto",
      category: "paid",
      billingType: "recurring",
      pricingModel: "unit",
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_PREMIUM_UNIT_AUTO_MONTHLY_PRODUCT_ID ??
          "prod_3861b06bJDnvpEBcs2uxYv",
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
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_SUB_PERIOD_END_BASIC_MONTHLY ?? "",
      },
    },
    {
      planId: "period-end-premium",
      category: "paid",
      billingType: "recurring",
      title: "Period Premium",
      description: "Dedicated premium plan for scheduled update testing",
      recommended: true,
      products: {
        "every-month":
          import.meta.env.VITE_CREEM_SUB_PERIOD_END_PREMIUM_MONTHLY ?? "",
      },
    },
    {
      planId: "ai-credits-100",
      category: "paid",
      billingType: "onetime",
      title: "100 AI Credits",
      description: "Repeatable prepaid credit pack",
      products: {
        custom:
          import.meta.env.VITE_CREEM_ONETIME_CREDITS ??
          "prod_73CnZ794MaJ1DUn8MU0O5f",
      },
      creditGrant: {
        amount: "100",
        accountName: "credits",
        unitLabel: "credits",
        refundBehavior: "prorate",
      },
    },
  ],
} as const);

const upgradeTransitions: Transition[] = [
  {
    from: "prod_4Di7Lkhf3TXy4UOKsUrGw0",
    to: "prod_56sJIyL7piLCVv270n4KBz",
    kind: "via_product",
    viaProductId: "prod_5LApsYRX8dHbx8QuLJgJ3j",
  },
];

export default function App() {
  const billingModel = useQuery(api.billing.uiModel, {}) as
    | ConnectedBillingModel
    | undefined;
  const snapshot = billingModel?.snapshot ?? null;
  const generateDemoImageAction = useAction(api.billing.generateDemoImage);
  const [demoImageLoading, setDemoImageLoading] = useState(false);
  const [demoImageMessage, setDemoImageMessage] = useState<string | null>(null);
  const [demoImageError, setDemoImageError] = useState<string | null>(null);
  const usage = { aiMessages: 72, projects: 3 };
  const usagePlanId =
    (snapshot ? selectBaseSubscription(snapshot)?.planId : null) ??
    "basic-individual";
  const usageLimits = evaluateUsageLimits({
    catalog: billingCatalog,
    planId: usagePlanId,
    usage,
  });

  const generateDemoImage = async (refreshCredits?: () => Promise<void>) => {
    setDemoImageLoading(true);
    setDemoImageMessage(null);
    setDemoImageError(null);
    try {
      const result = await generateDemoImageAction({});
      await refreshCredits?.();
      setDemoImageMessage(
        `Generated demo image and consumed ${result.creditsConsumed} credits.`,
      );
    } catch (cause) {
      setDemoImageError(
        getConvexErrorMessage(cause, "Could not generate the demo image"),
      );
    } finally {
      setDemoImageLoading(false);
    }
  };

  return (
    <CreemConvexProvider api={connectedApi} catalog={billingCatalog}>
      <main className="w-full py-10 lg:pt-16">
        <header className="border-b border-border-subtle pb-16 lg:pb-[104px]">
          <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-2">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="display-m max-w-[720px] text-foreground-default">
                Drop-in Billing for Convex Apps
              </h1>
              <p className="subtitle-m max-w-[720px] text-foreground-default">
                Subscriptions, one-time purchases, unit-based pricing, and a
                customer portal — all powered by Creem and wired to your Convex
                backend. Available for React and Svelte.
              </p>
              <div className="pt-8 text-foreground-placeholder">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-8 items-center justify-center opacity-70">
                    <img
                      src={creemLogoUrl}
                      alt="Creem"
                      className="h-7 w-auto"
                    />
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center opacity-70">
                    <img src={convexLogoUrl} alt="Convex" className="h-7 w-7" />
                  </span>
                </div>
              </div>
            </div>

            <nav className="lg:col-start-10 lg:col-span-3 space-y-10 lg:pt-2">
              <div className="space-y-4">
                <p className="label-m text-foreground-placeholder">
                  SUBSCRIPTIONS WIDGETS
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      01
                    </span>
                    <a href="#subscription-app-trial" className="link-inline">
                      App Trial
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      02
                    </span>
                    <a href="#subscription-with-trial" className="link-inline">
                      With Trial (4 Cycles)
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      03
                    </span>
                    <a
                      href="#subscription-without-trial"
                      className="link-inline"
                    >
                      Without Trial (Monthly Only)
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      04
                    </span>
                    <a
                      href="#subscription-unit-selectable"
                      className="link-inline"
                    >
                      Individual vs Teams
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      05
                    </span>
                    <a href="#subscription-unit-auto" className="link-inline">
                      Unit-Based (Auto-Derived)
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      06
                    </span>
                    <a
                      href="#subscription-custom-composition"
                      className="link-inline"
                    >
                      Custom Composition
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      07
                    </span>
                    <a href="#subscription-period-end" className="link-inline">
                      Period-End Change
                    </a>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="label-m text-foreground-placeholder">
                  ONE TIME PURCHASE WIDGETS
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      08
                    </span>
                    <a href="#onetime-single" className="link-inline">
                      Single One-Time Product
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      09
                    </span>
                    <a href="#onetime-group" className="link-inline">
                      Mutually Exclusive Product Group
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      10
                    </span>
                    <a href="#onetime-repeat" className="link-inline">
                      Repeating Product (Consumable)
                    </a>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="label-m text-foreground-placeholder">
                  ACCOUNT WIDGETS
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      11
                    </span>
                    <a href="#billing-history" className="link-inline">
                      Billing History
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                      12
                    </span>
                    <a href="#feature-usage-gate" className="link-inline">
                      Feature / Usage Gate
                    </a>
                  </div>
                </div>
              </div>
              <a
                href="https://github.com/armitage-labs/creem/tree/main/packages/convex"
                target="_blank"
                rel="noopener noreferrer"
                className="button-outline inline-flex items-center justify-center gap-2"
              >
                <GithubIcon className="size-4" />
                <span>Github</span>
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 space-y-14 pt-14">
          <CheckoutSuccessSummary className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" />

          {/* Test card info */}
          <div className="rounded-lg border border-surface-300-700 bg-surface-100-900 px-4 py-3 text-sm text-foreground-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-medium text-foreground-default">
                Test cards:
              </span>
              {TEST_CARDS.map((card) => (
                <TestCardChip
                  key={card.number}
                  number={card.number}
                  behavior={card.behavior}
                />
              ))}
            </div>
            <div className="mt-1 text-foreground-placeholder">
              Any future expiry, any CVC, any cardholder name.
            </div>
          </div>

          {/* ─── Section 1: App-owned no-card trial ─── */}
          <section
            id="subscription-app-trial"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  App Trial + Free + Paid
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A no-card trial is an app-owned plan. The widget activates it
                  via your Convex mutation, records once-per-entity history in
                  the component, and hides it after it has already been used.
                </p>
              </div>

              <div className="mt-10">
                <Subscription.Root
                  plans={plansOf(billingCatalog, [
                    "trial",
                    "free",
                    "basic-individual",
                  ])}
                />
              </div>
            </div>
          </section>

          {/* ─── Section 2: Subscriptions with trial (all 4 billing cycles) ─── */}
          <section
            id="subscription-with-trial"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  With Trial (4 Cycles)
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Subscription plans with a free trial. Monthly, quarterly,
                  semi-annual, and annual billing cycles — the cycle toggle
                  appears automatically from the registered plans.
                </p>
              </div>

              <div className="mt-10">
                <Subscription.Root className="">
                  <Subscription.Item
                    type="free"
                    title="Free"
                    description={`✔️ Up to 3 projects\n✔️ Basic task boards\n✔️ 500 MB storage\n✔️ Community support`}
                  />
                  <Subscription.Item
                    planId="basic"
                    type="single"
                    title="Basic"
                    productIds={{
                      "every-month": "prod_4if4apw1SzOXSUAfGL0Jp9",
                      "every-three-months": "prod_5SxwV6WbbluzUQ2FmZ4trD",
                      "every-six-months": "prod_7Lhs8en6kiBONIywQUlaQC",
                      "every-year": "prod_KE9mMfH58482NIbKgK4nF",
                    }}
                  />
                  <Subscription.Item
                    planId="premium"
                    type="single"
                    title="Premium"
                    recommended
                    productIds={{
                      "every-month": "prod_7Cukw2hVIT5DvozmomK67A",
                      "every-three-months": "prod_7V5gRIqWgui5wQflemUBOF",
                      "every-six-months": "prod_4JN9cHsEto3dr0CQpgCxn4",
                      "every-year": "prod_6ytx0cFhBvgXLp1jA6CQqH",
                    }}
                  />
                  <Subscription.Item
                    type="enterprise"
                    title="Enterprise"
                    description={`✔️ Everything in Premium\n✔️ Unlimited storage\n✔️ SSO & SAML\n✔️ Dedicated account manager\n✔️ Custom integrations\n✔️ 99.9% SLA`}
                    contactUrl="https://creem.io"
                  />
                </Subscription.Root>
              </div>

              <div className="flex justify-center pt-16">
                <BillingPortal className="button-faded" />
              </div>
            </div>
          </section>

          {/* ─── Section 3: Subscriptions without trial (monthly only) ─── */}
          <section
            id="subscription-without-trial"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  Without Trial (Monthly Only)
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Monthly-only plans with no trial period. Since only one
                  billing cycle is registered, the cycle toggle is hidden
                  automatically.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Subscription.Root>
                  <Subscription.Item
                    type="free"
                    title="Free"
                    description={`✔️ 1 user included\n✔️ Basic email support\n✔️ 1 GB storage\n✔️ Standard templates`}
                  />
                  <Subscription.Item
                    planId="basic-monthly"
                    type="single"
                    title="Basic"
                    productIds={{
                      "every-month": "prod_53CU7duHB58lGTUqKlRroI",
                    }}
                  />
                  <Subscription.Item
                    planId="professional-monthly"
                    type="single"
                    title="Professional"
                    productIds={{
                      "every-month": "prod_3ymOe55fDzKgmPoZnPEOBq",
                    }}
                  />
                </Subscription.Root>
              </div>

              <div className="flex justify-center pt-16">
                <BillingPortal className="button-faded" />
              </div>
            </div>
          </section>

          {/* ─── Section 4: Unit-based subscriptions ─── */}
          <section
            id="subscription-unit-selectable"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  Individual vs Teams
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Grouped pricing for personal and team plans. Individual plans
                  are flat subscriptions; team plans use unit-based pricing
                  where the unit can represent a member, domain, or any other
                  billable quantity.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Subscription.Root
                  showUnitPicker
                  groups={[
                    {
                      value: "individual",
                      label: "Individual",
                      plans: plansOf(billingCatalog, [
                        "basic-individual",
                        "premium-individual",
                      ]),
                    },
                    {
                      value: "teams",
                      label: "Teams",
                      plans: plansOf(billingCatalog, [
                        "basic-team",
                        "premium-team",
                      ]),
                    },
                  ]}
                />
              </div>

              <div className="flex justify-center pt-16">
                <BillingPortal className="button-faded" />
              </div>
            </div>
          </section>

          {/* ─── Section 5: Unit-based with auto-derived units ─── */}
          <section
            id="subscription-unit-auto"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  Unit-Based (Auto-Derived)
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Unit-based pricing with a fixed quantity derived from your app
                  data. No picker is shown — the unit count is set
                  programmatically. Hardcoded to 5 in this demo.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Subscription.Root
                  plans={plansOf(billingCatalog, [
                    "basic-unit-auto",
                    "premium-unit-auto",
                  ])}
                  units={5}
                  columns={2}
                />
              </div>
            </div>
          </section>

          {/* ─── Section 6: Custom subscription composition ─── */}
          <section
            id="subscription-custom-composition"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  Custom Composition
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  React can use the same compound widget shape: the app owns
                  markup and copy while Creem state, prices, checkout, and plan
                  switching come from the billing widget context.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Subscription.Root
                  groupSelector="external"
                  groups={[
                    {
                      value: "individual",
                      label: "Individual",
                      plans: plansOf(billingCatalog, [
                        "basic-individual",
                        "premium-individual",
                      ]),
                    },
                    {
                      value: "teams",
                      label: "Teams",
                      plans: plansOf(billingCatalog, [
                        "basic-team",
                        "premium-team",
                      ]),
                    },
                  ]}
                >
                  <div className="mb-10 flex justify-center">
                    <Subscription.GroupSelector />
                  </div>

                  <Subscription.Group value="individual" label="Individual">
                    <Subscription.Grid className="lg:grid-cols-2">
                      <Subscription.Item
                        planId="basic-individual"
                        className="relative flex min-h-[320px] flex-col justify-between rounded-lg border border-border-subtle bg-surface-base p-6"
                      >
                        <div className="space-y-5">
                          <Subscription.ItemBadge
                            label="Für Einzelpersonen"
                            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          />
                          <div className="space-y-2">
                            <Subscription.ItemTitle className="heading-s text-foreground-default" />
                            <Subscription.ItemDescription className="body-m text-foreground-muted" />
                          </div>
                          <Subscription.ItemPrice className="display-s text-foreground-default" />
                          <ul className="body-m space-y-2 text-foreground-default">
                            <li>Personal workspace</li>
                            <li>Basic automations</li>
                            <li>Community support</li>
                          </ul>
                        </div>
                        <Subscription.ItemCTA
                          className="mt-8"
                          checkoutLabel="Start individual"
                          switchLabel="Switch individual"
                        />
                        <Subscription.Cancel className="mt-2" />
                      </Subscription.Item>

                      <Subscription.Item
                        planId="premium-individual"
                        className="relative flex min-h-[320px] flex-col justify-between rounded-lg border-2 border-primary-border-default bg-surface-base p-6"
                      >
                        <div className="space-y-5">
                          <Subscription.ItemBadge label="Popular" />
                          <div className="space-y-2">
                            <Subscription.ItemTitle className="heading-s text-foreground-default" />
                            <Subscription.ItemDescription className="body-m text-foreground-muted" />
                          </div>
                          <Subscription.ItemPrice className="display-s text-foreground-default" />
                          <ul className="body-m space-y-2 text-foreground-default">
                            <li>Unlimited personal projects</li>
                            <li>Priority support</li>
                            <li>Advanced usage limits</li>
                          </ul>
                        </div>
                        <Subscription.ItemCTA
                          className="mt-8"
                          checkoutLabel="Go premium"
                          switchLabel="Switch to premium"
                        />
                        <Subscription.Cancel className="mt-2" />
                      </Subscription.Item>
                    </Subscription.Grid>
                  </Subscription.Group>

                  <Subscription.Group value="teams" label="Teams">
                    <Subscription.Grid className="lg:grid-cols-2">
                      <Subscription.Item
                        planId="basic-team"
                        className="relative flex min-h-[320px] flex-col justify-between rounded-lg border border-border-subtle bg-surface-base p-6"
                      >
                        <div className="space-y-5">
                          <Subscription.ItemBadge
                            label="Teams"
                            className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                          />
                          <div className="space-y-2">
                            <Subscription.ItemTitle className="heading-s text-foreground-default" />
                            <Subscription.ItemDescription className="body-m text-foreground-muted" />
                          </div>
                          <Subscription.ItemPrice className="display-s text-foreground-default" />
                          <Subscription.ItemPriceCaption className="body-m text-foreground-muted" />
                          <Subscription.UnitPicker detailed />
                          <ul className="body-m space-y-2 text-foreground-default">
                            <li>Shared billing for every unit</li>
                            <li>Team workspace</li>
                            <li>Role-based access</li>
                          </ul>
                        </div>
                        <Subscription.ItemCTA
                          className="mt-8"
                          checkoutLabel="Start team plan"
                          switchLabel="Switch team plan"
                        />
                        <Subscription.Cancel className="mt-2" />
                      </Subscription.Item>

                      <Subscription.Item
                        planId="premium-team"
                        className="relative flex min-h-[320px] flex-col justify-between rounded-lg border-2 border-primary-border-default bg-surface-base p-6"
                      >
                        <div className="space-y-5">
                          <Subscription.ItemBadge label="Best for teams" />
                          <div className="space-y-2">
                            <Subscription.ItemTitle className="heading-s text-foreground-default" />
                            <Subscription.ItemDescription className="body-m text-foreground-muted" />
                          </div>
                          <Subscription.ItemPrice className="display-s text-foreground-default" />
                          <Subscription.ItemPriceCaption className="body-m text-foreground-muted" />
                          <Subscription.UnitPicker detailed />
                          <ul className="body-m space-y-2 text-foreground-default">
                            <li>Advanced team controls</li>
                            <li>Higher usage limits</li>
                            <li>Priority team support</li>
                          </ul>
                        </div>
                        <Subscription.ItemCTA
                          className="mt-8"
                          checkoutLabel="Upgrade team"
                          switchLabel="Switch team plan"
                        />
                        <Subscription.Cancel className="mt-2" />
                      </Subscription.Item>
                    </Subscription.Grid>
                  </Subscription.Group>
                </Subscription.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 7: Period-end scheduled subscription update ─── */}
          <section
            id="subscription-period-end"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    Subscription
                  </span>
                  <br />
                  Period-End Plan Change
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Uses dedicated products and an <code>updateBehavior</code>{" "}
                  resolver. Paid downgrades stay active until period end,
                  free-plan switches use the dedicated cancellation behavior,
                  and upgrades use Creem proration on the next invoice.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Subscription.Root
                  updateBehavior={(intent) => {
                    if (
                      intent.fromPrice != null &&
                      intent.toPrice != null &&
                      intent.toPrice < intent.fromPrice
                    ) {
                      return "period-end";
                    }
                    return "proration-charge";
                  }}
                  freePlanUpdateBehavior="period-end"
                  plans={plansOf(billingCatalog, [
                    "period-end-free",
                    "period-end-basic",
                    "period-end-premium",
                  ])}
                />
              </div>

              <div className="flex justify-center pt-16">
                <BillingPortal className="button-faded" />
              </div>
            </div>
          </section>

          {/* ─── Section 8: Standalone one-time product ─── */}
          <section
            id="onetime-single"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    One Time Purchase
                  </span>
                  <br />
                  Single One-Time Product
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A single product that can be purchased once. After purchase,
                  the card displays an &ldquo;Owned&rdquo; badge instead of a
                  buy button.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Product.Root layout="single" styleVariant="pricing">
                  <Product.Item
                    type="one-time"
                    title="One-time purchase"
                    productId="prod_6npEfkzgtr9hSqdWd7fqKG"
                  />
                </Product.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 9: Mutually exclusive product group with upgrade ─── */}
          <section
            id="onetime-group"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    One Time Purchase
                  </span>
                  <br />
                  Mutually Exclusive Product Group
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A group of products where owning one affects available actions
                  on others. Upgrade paths are defined via a transition graph —
                  upgrading from Basic to Premium uses a dedicated delta
                  product. Product images are synced from Creem.
                </p>
                <p className="body-l col-span-12 mt-2 text-center font-medium text-foreground-default lg:col-start-4 lg:col-span-6">
                  Try it: Buy the Basic product first, then upgrade to Premium.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Product.Root
                  transition={upgradeTransitions}
                  styleVariant="pricing"
                  showImages
                >
                  <Product.Item
                    type="one-time"
                    title="Basic"
                    productId="prod_4Di7Lkhf3TXy4UOKsUrGw0"
                  />
                  <Product.Item
                    type="one-time"
                    title="Premium"
                    productId="prod_56sJIyL7piLCVv270n4KBz"
                  />
                </Product.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 10: Repeating (consumable) product ─── */}
          <section
            id="onetime-repeat"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    One Time Purchase
                  </span>
                  <br />
                  Repeating Product (Consumable)
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A consumable product that can be purchased repeatedly (e.g.
                  credits, tokens). The buy button stays active after every
                  purchase — no &ldquo;Owned&rdquo; badge is shown. Product
                  image is synced from Creem.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <Product.Root
                  layout="single"
                  styleVariant="pricing"
                  showImages
                  pricingCtaVariant="filled"
                >
                  <Product.Item
                    type="recurring"
                    title="100 AI Credits"
                    productId="prod_73CnZ794MaJ1DUn8MU0O5f"
                  />
                </Product.Root>
              </div>

              <div className="mt-12 flex justify-center">
                <Credits.Root unitLabel="credits">
                  {(credits) => (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <Credits.Title>Credit Balance</Credits.Title>
                        <Credits.Refresh />
                      </div>
                      <Credits.Amount />
                      <Credits.Error />

                      {demoImageMessage && (
                        <div className="label-s text-success-foreground-default">
                          {demoImageMessage}
                        </div>
                      )}
                      {demoImageError && (
                        <div className="body-m radius-m border border-error-border-subtle bg-error-surface-subtle px-3 py-2 text-error-foreground-default">
                          {demoImageError}
                        </div>
                      )}

                      <button
                        className="button-filled h-10 w-full disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void generateDemoImage(credits.refresh)}
                        disabled={demoImageLoading}
                      >
                        {demoImageLoading
                          ? "Generating..."
                          : "Generate image (10 credits)"}
                      </button>
                    </>
                  )}
                </Credits.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 11: Billing history ─── */}
          <section
            id="billing-history"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">Account</span>
                  <br />
                  Billing History
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A paginated transaction history sourced from Creem
                  transactions. Invoice and receipt documents are not included
                  in this transaction view.
                </p>
              </div>

              <div className="mt-[6.5rem]">
                <BillingHistory pageSize={5} />
              </div>
            </div>
          </section>

          {/* ─── Section 12: Feature and usage gate ─── */}
          <section
            id="feature-usage-gate"
            className="relative left-1/2 -translate-x-1/2 w-screen pb-[6.5rem]"
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">Account</span>
                  <br />
                  Feature / Usage Gate
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  App-owned usage counters are evaluated against catalog limits.
                  Billing state gates feature access, while the app stays
                  responsible for measuring actual usage.
                </p>
              </div>

              <div className="mx-auto mt-[6.5rem] grid max-w-3xl gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border-subtle bg-surface-base p-5">
                  <p className="label-m text-foreground-placeholder">
                    Current usage
                  </p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between body-m text-foreground-default">
                        <span>AI messages</span>
                        <span>
                          {usageLimits.aiMessages.used} /{" "}
                          {usageLimits.aiMessages.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle">
                        <div
                          className={`h-full rounded-full ${
                            usageLimits.aiMessages.exceeded
                              ? "bg-red-500"
                              : "bg-primary-border-default"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (usageLimits.aiMessages.used /
                                usageLimits.aiMessages.limit) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between body-m text-foreground-default">
                        <span>Projects</span>
                        <span>
                          {usageLimits.projects.used} /{" "}
                          {usageLimits.projects.limit}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle">
                        <div
                          className={`h-full rounded-full ${
                            usageLimits.projects.exceeded
                              ? "bg-red-500"
                              : "bg-primary-border-default"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (usageLimits.projects.used /
                                usageLimits.projects.limit) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border-subtle bg-surface-base p-5">
                  <p className="label-m text-foreground-placeholder">
                    Feature gate
                  </p>
                  <div className="mt-4">
                    <BillingGate
                      snapshot={snapshot}
                      requiredActions="portal"
                      fallback={
                        <div className="rounded-lg bg-surface-subtle p-4 body-m text-foreground-muted">
                          Billing management is hidden until this account has
                          portal access.
                        </div>
                      }
                    >
                      <div className="rounded-lg bg-emerald-50 p-4 body-m text-emerald-900">
                        Billing management is available for this account.
                      </div>
                    </BillingGate>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </CreemConvexProvider>
  );
}
