import {
  BillingGate,
  CheckoutSuccessSummary,
  BillingHistory,
  BillingPortal,
  CreemConvexProvider,
  Credits,
  Product,
  Subscription,
  TrialLimitBanner,
  evaluateUsageLimits,
  plansOf,
  selectBaseSubscription,
  getConvexErrorMessage,
  connectCreemApi,
  createCreemReact,
  PaymentRecoveryBanner,
  PaymentRecoveryButton,
  type ConnectedBillingApi,
  type PlanChangeIntent,
  type ConnectedBillingModel,
  type Transition,
} from "@creem_io/convex/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { billingCatalog, env } from "../../example-shared/billingCatalog";
import creemLogoUrl from "./assets/creem.svg";
import convexLogoUrl from "./assets/convex.svg";
import { CheckIcon, CopyIcon, GithubIcon } from "lucide-react";

const TOC = [
  {
    title: "SUBSCRIPTION VARIANTS",
    items: [
      { n: "01", href: "#sub-one-plan", label: "Minimal One Plan" },
      { n: "02", href: "#sub-two-plans", label: "Minimal Two Plans" },
      { n: "03", href: "#subscription-app-trial", label: "App Trial" },
      {
        n: "04",
        href: "#subscription-with-trial",
        label: "Creem Trial + Multi-Cycle",
      },
      {
        n: "05",
        href: "#subscription-unit-selectable",
        label: "Individual / Teams",
      },
      { n: "06", href: "#subscription-unit-auto", label: "Unit-Based" },
      { n: "07", href: "#sub-grouped-cycles", label: "Grouped Multi-Cycle" },
      { n: "08", href: "#sub-consent-gates", label: "Consent Gates" },
      {
        n: "09",
        href: "#subscription-custom-composition",
        label: "Custom Composition",
      },
      { n: "10", href: "#sub-typed-binding", label: "Typed Binding API" },
      { n: "11", href: "#subscription-period-end", label: "Period-End Change" },
    ],
  },
  {
    title: "ONE TIME PURCHASE",
    items: [
      { n: "12", href: "#onetime-single", label: "Single Product" },
      { n: "13", href: "#onetime-group", label: "Product Group + Upgrade" },
      { n: "14", href: "#onetime-repeat", label: "Consumable (Repeating)" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { n: "15", href: "#payment-recovery", label: "Payment Recovery" },
      { n: "16", href: "#billing-history", label: "Billing History" },
      { n: "17", href: "#feature-usage-gate", label: "Feature / Usage Gate" },
    ],
  },
];

const TOC_TITLE =
  "hidden group-hover:block group-focus-within:block [@media(min-width:1820px)]:block";

const TocGroups = () => (
  <>
    {TOC.map((group) => (
      <div key={group.title} className="space-y-4">
        <p className={`label-m text-foreground-placeholder ${TOC_TITLE}`}>
          {group.title}
        </p>
        <div className="space-y-1">
          {group.items.map((item) => (
            <div key={item.href} className="flex items-center gap-3">
              <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                {item.n}
              </span>
              <a href={item.href} className="link-inline whitespace-nowrap">
                {item.label}
              </a>
            </div>
          ))}
        </div>
      </div>
    ))}
  </>
);

function FloatingToc() {
  return (
    <nav
      aria-label="Examples"
      className="group fixed right-2 top-1/2 z-40 hidden w-12 max-h-[80vh] -translate-y-1/2 space-y-8 overflow-x-hidden overflow-y-auto radius-m border border-border-subtle bg-surface-elevated p-3 shadow-md hover:w-auto focus-within:w-auto xl:block [@media(min-width:1820px)]:right-4 [@media(min-width:1820px)]:w-auto [@media(min-width:1820px)]:p-4"
    >
      <TocGroups />
    </nav>
  );
}

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
    <button
      type="button"
      title={`Copy ${number}`}
      onClick={() => {
        void navigator.clipboard.writeText(number);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-base px-3 py-2.5 text-left transition-colors hover:border-primary-border-default"
    >
      <span className="min-w-0">
        <span className="block font-mono text-sm text-foreground-default tabular-nums">
          {number}
        </span>
        <span className="block body-s text-foreground-placeholder">
          {behavior}
        </span>
      </span>
      {copied ? (
        <CheckIcon className="size-4 shrink-0 text-emerald-600" />
      ) : (
        <CopyIcon className="size-4 shrink-0 text-foreground-placeholder opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

// One call maps every generated `convex/billing.ts` export onto the widget API.
// Exports you leave out simply hide the matching controls, and a wrong or
// missing export is a compile error rather than a runtime surprise.
const connectedApi: ConnectedBillingApi = connectCreemApi(api.billing);

// Typed binding: catalog + API refs in one object with typed plan IDs.
const billing = createCreemReact({
  catalog: billingCatalog,
  api: connectedApi,
  defaultCycle: "every-month",
});

const upgradeTransitions: Transition[] = [
  {
    from: env.onetimeBasic,
    to: env.onetimePremium,
    kind: "via_product",
    viaProductId: env.onetimeUpgradeDelta,
  },
];

export default function App() {
  const billingModel = useQuery(api.billing.uiModel, {}) as
    | ConnectedBillingModel
    | undefined;
  // ──────────────────────────────────────────────────────────────────────────
  // Consent gate handlers (demo)
  // ──────────────────────────────────────────────────────────────────────────
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState("");

  const ensureConsentAccepted = () => {
    if (consentAccepted) {
      setConsentError("");
      return true;
    }
    setConsentError("Please accept the billing policy before continuing.");
    return false;
  };

  const onBeforeCheckout = async (_intent: {
    productId: string;
    units?: number;
  }) => ensureConsentAccepted();
  const onBeforePlanChange = async (_intent: PlanChangeIntent) =>
    ensureConsentAccepted();
  const onBeforePlanActivation = async (_intent: { planId: string }) =>
    ensureConsentAccepted();

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
      <main className="w-full py-8 lg:pt-12">
        <header className="border-b border-border-subtle pb-12 lg:pb-20">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-2">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="display-m max-w-180 text-foreground-default">
                Drop-in Billing for Convex Apps
              </h1>
              <p className="subtitle-m max-w-180 text-foreground-default">
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

            <div className="lg:col-start-10 lg:col-span-3 lg:pt-2">
              <a
                href="https://github.com/armitage-labs/creem/tree/main/packages/convex"
                target="_blank"
                rel="noopener noreferrer"
                className="button-outline inline-flex items-center justify-center gap-2"
              >
                <GithubIcon className="size-4" />
                <span>Github</span>
              </a>
            </div>
          </div>
        </header>

        <FloatingToc />

        <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 space-y-12 pt-12">
          <CheckoutSuccessSummary className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" />

          {/* Test card info */}
          <div className="radius-m border border-border-subtle bg-surface-subtle p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="label-m text-foreground-default">Test cards</p>
              <p className="body-s text-foreground-placeholder">
                Any future expiry, any CVC, any cardholder name.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {TEST_CARDS.map((card) => (
                <TestCardChip
                  key={card.number}
                  number={card.number}
                  behavior={card.behavior}
                />
              ))}
            </div>
          </div>

          {/* ─── 02: Minimal One Plan ─── */}
          <section
            id="sub-one-plan"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    01 — Subscription
                  </span>
                  <br />
                  Minimal One Plan
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  The smallest catalog-driven subscription widget: one root, one
                  plan slug, default UI. Product IDs stay in the catalog so this
                  markup is stable across test and production.
                </p>
              </div>
              <div className="mt-12">
                <Subscription.Root plans={plansOf(billingCatalog, ["pro"])} />
              </div>
            </div>
          </section>

          {/* ─── 03: Minimal Two Plans ─── */}
          <section
            id="sub-two-plans"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    02 — Subscription
                  </span>
                  <br />
                  Minimal Two Plans
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A compact default pricing section with two paid plan slugs
                  from the catalog.
                </p>
              </div>
              <div className="mt-12">
                <Subscription.Root
                  plans={plansOf(billingCatalog, ["basic", "premium"])}
                />
              </div>
            </div>
          </section>

          {/* ─── Section 1: App-owned no-card trial ─── */}
          <section
            id="subscription-app-trial"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    03 — Subscription
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

              <div className="mt-12">
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
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    04 — Subscription
                  </span>
                  <br />
                  Creem Trial + 4 Cycles
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  These Creem products carry a trial, so checkout starts one.
                  Creem has no product API for trial length, so the card reads
                  it from <code>trialDays</code> in the catalog. Monthly,
                  quarterly, semi-annual, and annual cycles; the toggle appears
                  automatically from the registered plans.
                </p>
              </div>

              {/* TrialLimitBanner reads snapshot.subscriptions for status
                  "trialing", so it only fires for a Creem-managed trial like the
                  products below. An app-owned trial writes an appPlanAssignment
                  instead and never reaches this banner. */}
              <div className="mx-auto mt-12 max-w-180">
                <TrialLimitBanner snapshot={snapshot} />
              </div>

              <div className="mt-12">
                <Subscription.Root
                  plans={plansOf(billingCatalog, [
                    "free",
                    "basic-multi-cycle",
                    "premium-multi-cycle",
                  ])}
                />
              </div>

              <div className="flex justify-center pt-16">
                <BillingPortal className="button-faded" />
              </div>
            </div>
          </section>

          {/* ─── Section 4: Unit-based subscriptions ─── */}
          <section
            id="subscription-unit-selectable"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    05 — Subscription
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

              <div className="mt-12">
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
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    06 — Subscription
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

              <div className="mt-12">
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

          {/* ─── 07: Grouped Multi-Cycle ─── */}
          <section
            id="sub-grouped-cycles"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    07 — Subscription
                  </span>
                  <br />
                  Grouped Multi-Cycle
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Audience groups where each group carries its own billing
                  cycles. The active group decides which intervals the toggle
                  offers.
                </p>
              </div>
              <div className="mt-12">
                <Subscription.Root
                  showUnitPicker
                  groups={[
                    {
                      value: "individual-cycle",
                      label: "Individual",
                      plans: plansOf(billingCatalog, [
                        "basic-individual-cycle",
                        "premium-individual-cycle",
                      ]),
                    },
                    {
                      value: "teams-cycle",
                      label: "Teams",
                      plans: plansOf(billingCatalog, [
                        "basic-team-cycle",
                        "premium-team-cycle",
                      ]),
                    },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* ─── 08: Consent Gates ─── */}
          <section
            id="sub-consent-gates"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    08 — Subscription
                  </span>
                  <br />
                  Consent Gates
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Demonstrates onBeforeCheckout, onBeforePlanChange, and
                  onBeforePlanActivation with an app-owned policy checkbox.
                  Checkout and plan changes continue only after consent is
                  accepted.
                </p>
              </div>
              <div className="mt-12 flex flex-col items-center gap-2">
                <label className="body-m flex items-center gap-3 text-foreground-default">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={consentAccepted}
                    onChange={(e) => {
                      setConsentAccepted(e.target.checked);
                      if (e.target.checked) setConsentError("");
                    }}
                  />
                  <span>I accept the billing policy for this demo.</span>
                </label>
                {consentError && (
                  <p className="body-s text-red-500">{consentError}</p>
                )}
              </div>

              <div className="mt-12">
                <Subscription.Root
                  plans={plansOf(billingCatalog, ["free", "basic", "premium"])}
                  onBeforeCheckout={onBeforeCheckout}
                  onBeforePlanChange={onBeforePlanChange}
                  onBeforePlanActivation={onBeforePlanActivation}
                />
              </div>
            </div>
          </section>

          {/* ─── Section 6: Custom subscription composition ─── */}
          <section
            id="subscription-custom-composition"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    09 — Subscription
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

              <div className="mt-12">
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

          {/* ─── 10: Typed Binding API ─── */}
          <section
            id="sub-typed-binding"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    10 — Subscription
                  </span>
                  <br />
                  Typed Binding API
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  Uses createCreemReact to bind catalog and API refs into a
                  single typed object. The binding spreads onto
                  CreemConvexProvider, and the widget receives typed plan IDs
                  without direct API props.
                </p>
              </div>
              <CreemConvexProvider {...billing}>
                <div className="mt-12">
                  <Subscription.Root plans={billing.planIds} />
                </div>

                <div className="flex justify-center pt-16">
                  <BillingPortal className="button-faded" />
                </div>
              </CreemConvexProvider>
            </div>
          </section>

          {/* ─── Section 7: Period-end scheduled subscription update ─── */}
          <section
            id="subscription-period-end"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    11 — Subscription
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

              <div className="mt-12">
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
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    12 — One Time Purchase
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

              <div className="mt-12">
                <Product.Root layout="single" styleVariant="pricing">
                  <Product.Item
                    type="one-time"
                    title="One-time purchase"
                    productId={env.onetimeSingle}
                  />
                </Product.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 9: Mutually exclusive product group with upgrade ─── */}
          <section
            id="onetime-group"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    13 — One Time Purchase
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

              <div className="mt-12">
                <Product.Root
                  transition={upgradeTransitions}
                  styleVariant="pricing"
                  showImages
                >
                  <Product.Item
                    type="one-time"
                    title="Basic"
                    productId={env.onetimeBasic}
                  />
                  <Product.Item
                    type="one-time"
                    title="Premium"
                    productId={env.onetimePremium}
                  />
                </Product.Root>
              </div>
            </div>
          </section>

          {/* ─── Section 10: Repeating (consumable) product ─── */}
          <section
            id="onetime-repeat"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    14 — One Time Purchase
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

              <div className="mt-12">
                <Product.Root
                  layout="single"
                  styleVariant="pricing"
                  showImages
                  pricingCtaVariant="filled"
                >
                  <Product.Item
                    type="recurring"
                    title="100 AI Credits"
                    productId={env.onetimeCredits}
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

          {/* ─── 15: Payment Recovery ─── */}
          <section
            id="payment-recovery"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    15 — Account
                  </span>
                  <br />
                  Payment Recovery
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  <code>PaymentRecoveryBanner</code> auto-detects payment issues
                  from subscription state. <code>PaymentRecoveryButton</code>{" "}
                  opens the customer portal for payment method updates. Shown
                  here with forced states for demo purposes.
                </p>
              </div>

              <div className="mx-auto mt-12 max-w-xl space-y-4">
                <PaymentRecoveryBanner recoveryState="warning" />
                <PaymentRecoveryBanner recoveryState="blocked" />
                <PaymentRecoveryButton />
              </div>
            </div>
          </section>

          {/* ─── Section 11: Billing history ─── */}
          <section
            id="billing-history"
            className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    16 — Account
                  </span>
                  <br />
                  Billing History
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  A paginated transaction history sourced from Creem
                  transactions. Invoice and receipt documents are not included
                  in this transaction view.
                </p>
              </div>

              <div className="mt-12">
                <BillingHistory pageSize={5} />
              </div>
            </div>
          </section>

          {/* ─── Section 12: Feature and usage gate ─── */}
          <section
            id="feature-usage-gate"
            className="relative left-1/2 -translate-x-1/2 w-screen pb-20"
          >
            <div className="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
              <div className="mx-auto grid grid-cols-12">
                <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                  <span className="text-foreground-placeholder">
                    17 — Account
                  </span>
                  <br />
                  Feature / Usage Gate
                </h2>
                <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                  App-owned usage counters are evaluated against catalog limits.
                  Billing state gates feature access, while the app stays
                  responsible for measuring actual usage.
                </p>
              </div>

              <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
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
