<script lang="ts">
  import {
    setupConvex,
    useConvexClient,
    useQuery,
  } from "convex-svelte";
  import {
    BillingGate,
    CheckoutSuccessSummary,
    BillingHistory,
    BillingPortal,
    Credits,
    CreemConvexProvider,
    Product,
    Subscription,
    PaymentRecoveryBanner,
    PaymentRecoveryButton,
    defineBillingCatalog,
    createCreemSvelte,
    evaluateUsageLimits,
    getConvexErrorMessage,
    plansOf,
    selectBaseSubscription,
    connectCreemApi,
    type ConnectedBillingApi,
    type CreditsContextValue,
    type PlanChangeIntent,
    type Transition,
    type UpdateBehaviorIntent,
  } from "@creem_io/convex/svelte";
  import { api } from "../../convex/_generated/api.js";
  import creemLogoUrl from "./assets/creem.svg";
  import convexLogoUrl from "./assets/convex.svg";
  import { CheckIcon, CopyIcon, GithubIcon } from "@lucide/svelte";

  const TEST_CARDS = [
    { number: "4111 1111 1111 1111", behavior: "Successful payment" },
    { number: "4507 9900 0000 0028", behavior: "Card declined" },
    { number: "4507 9900 0000 0010", behavior: "Insufficient funds" },
    { number: "4507 9900 0000 0044", behavior: "Incorrect CVC" },
  ];
  let copiedCard = $state<string | null>(null);
  function copyTestCard(number: string) {
    void navigator.clipboard.writeText(number);
    copiedCard = number;
    window.setTimeout(() => {
      if (copiedCard === number) copiedCard = null;
    }, 1500);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Environment setup
  // ────────────────────────────────────────────────────────────────────────────

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) {
    throw new Error(
      "VITE_CONVEX_URL is required for the connected billing demo.",
    );
  }
  setupConvex(convexUrl);

  const detailedSelectorClass = [
    "flex w-full justify-center md:w-auto",
    "[&_[data-part=root]]:relative [&_[data-part=root]]:inline-flex [&_[data-part=root]]:items-stretch [&_[data-part=root]]:gap-1 [&_[data-part=root]]:rounded-lg [&_[data-part=root]]:border [&_[data-part=root]]:border-border-subtle [&_[data-part=root]]:bg-surface-subtle [&_[data-part=root]]:p-1",
    "[&_[data-part=indicator]]:absolute [&_[data-part=indicator]]:left-[var(--left)] [&_[data-part=indicator]]:top-[var(--top)] [&_[data-part=indicator]]:z-0 [&_[data-part=indicator]]:h-[var(--height)] [&_[data-part=indicator]]:w-[var(--width)] [&_[data-part=indicator]]:rounded-md [&_[data-part=indicator]]:bg-surface-base [&_[data-part=indicator]]:shadow-sm [&_[data-part=indicator]]:transition-[left,top,width,height] [&_[data-part=indicator]]:duration-150",
    "[&_[data-part=item]]:relative [&_[data-part=item]]:z-10 [&_[data-part=item]]:inline-flex [&_[data-part=item]]:min-h-8 [&_[data-part=item]]:cursor-pointer [&_[data-part=item]]:select-none [&_[data-part=item]]:items-center [&_[data-part=item]]:justify-center [&_[data-part=item]]:rounded-md [&_[data-part=item]]:px-3 [&_[data-part=item]]:py-1.5 [&_[data-part=item]]:text-sm [&_[data-part=item]]:font-medium [&_[data-part=item]]:text-foreground-muted [&_[data-part=item]]:outline-none",
    "[&_[data-part=item]:hover]:text-foreground-default [&_[data-part=item][data-state=checked]]:text-foreground-default [&_[data-part=item][data-focus-visible]]:ring-2 [&_[data-part=item][data-focus-visible]]:ring-primary-border-default [&_[data-part=item][data-disabled]]:cursor-not-allowed [&_[data-part=item][data-disabled]]:opacity-50",
    "[&_[data-part=item-text]]:relative [&_[data-part=item-text]]:z-10",
    "[&_[data-part=item-control]]:absolute [&_[data-part=item-control]]:inset-0 [&_[data-part=item-control]]:opacity-0",
  ].join(" ");

  // ────────────────────────────────────────────────────────────────────────────
  // Product IDs — all from env vars, NO hardcoded fallbacks
  // ────────────────────────────────────────────────────────────────────────────

  const env = {
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

  // ────────────────────────────────────────────────────────────────────────────
  // Connected API — Convex function references
  // ────────────────────────────────────────────────────────────────────────────

  // One call maps every generated `convex/billing.ts` export onto the widget
  // API. Exports you leave out simply hide the matching controls, and a wrong
  // or missing export is a compile error rather than a runtime surprise.
  const connectedApi: ConnectedBillingApi = connectCreemApi(api.billing);

  // ────────────────────────────────────────────────────────────────────────────
  // Billing catalog — used by catalog-driven variants
  // ────────────────────────────────────────────────────────────────────────────

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
        description:
          "✔ Unlimited projects\n✔ 100 GB storage\n✔ Priority support",
        recommended: true,
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

  // ────────────────────────────────────────────────────────────────────────────
  // Typed binding API — binds catalog + api into one typed object
  // ────────────────────────────────────────────────────────────────────────────

  const billing = createCreemSvelte({
    catalog: billingCatalog,
    api: connectedApi,
    defaultCycle: "every-month",
  });

  // ────────────────────────────────────────────────────────────────────────────
  // One-time product transitions (upgrade graph)
  // ────────────────────────────────────────────────────────────────────────────

  const upgradeTransitions: Transition[] = env.onetimeUpgradeDelta
    ? [
        {
          from: env.onetimeBasic,
          to: env.onetimePremium,
          kind: "via_product",
          viaProductId: env.onetimeUpgradeDelta,
        },
      ]
    : [];

  // ────────────────────────────────────────────────────────────────────────────
  // Consent gate handlers (demo)
  // ────────────────────────────────────────────────────────────────────────────

  let consentAccepted = $state(false);
  let consentError = $state("");

  const ensureConsentAccepted = () => {
    if (consentAccepted) {
      consentError = "";
      return true;
    }
    consentError = "Please accept the billing policy before continuing.";
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

  // ────────────────────────────────────────────────────────────────────────────
  // Feature / usage gate demo state
  // ────────────────────────────────────────────────────────────────────────────

  const billingModelQuery = useQuery(api.billing.uiModel, {});
  const snapshot = $derived(
    billingModelQuery.data?.snapshot ?? null,
  );
  const convexClient = useConvexClient();
  let demoImageLoading = $state(false);
  let demoImageMessage = $state<string | null>(null);
  let demoImageError = $state<string | null>(null);

  async function generateDemoImage(refreshCredits?: () => Promise<void>) {
    demoImageLoading = true;
    demoImageMessage = null;
    demoImageError = null;
    try {
      const result = await convexClient.action(
        api.billing.generateDemoImage,
        {},
      );
      await refreshCredits?.();
      demoImageMessage = `Generated demo image and consumed ${result.creditsConsumed} credits.`;
    } catch (cause) {
      demoImageError = getConvexErrorMessage(
        cause,
        "Could not generate the demo image",
      );
    } finally {
      demoImageLoading = false;
    }
  }
  const usage = { aiMessages: 72, projects: 3 };
  const usagePlanId = $derived(
    (snapshot
      ? selectBaseSubscription(snapshot)?.planId
      : null) ?? billingCatalog.defaultPlanId ?? "free",
  );
  const usageLimits = $derived(
    evaluateUsageLimits({
      catalog: billingCatalog,
      planId: usagePlanId,
      usage,
    }),
  );
</script>

<CreemConvexProvider api={connectedApi} catalog={billingCatalog}>
  <main class="w-full py-10 lg:pt-16">
    <header class="border-b border-border-subtle pb-16 lg:pb-[104px]">
      <div
        class="mx-auto w-full max-w-[1280px] px-6 lg:px-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-2"
      >
        <div class="lg:col-span-7 space-y-6">
          <h1 class="display-m max-w-[720px] text-foreground-default">
            Drop-in Billing for Convex Apps
          </h1>
          <p class="subtitle-m max-w-[720px] text-foreground-default">
            Subscriptions, one-time purchases, unit-based pricing, and a
            customer portal — all powered by Creem and wired to your Convex
            backend. Available for React and Svelte.
          </p>
          <div class="pt-8 text-foreground-placeholder">
            <div class="flex items-center gap-4">
              <span
                class="inline-flex h-8 items-center justify-center opacity-70"
              >
                <img src={creemLogoUrl} alt="Creem" class="h-7 w-auto" />
              </span>
              <span
                class="inline-flex h-8 w-8 items-center justify-center opacity-70"
              >
                <img src={convexLogoUrl} alt="Convex" class="h-7 w-7" />
              </span>
            </div>
          </div>
        </div>

        <nav class="lg:col-start-10 lg:col-span-3 space-y-10 lg:pt-2">
          <div class="space-y-4">
            <p class="label-m text-foreground-placeholder">
              SUBSCRIPTION VARIANTS
            </p>
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >01</span
                >
                <a href="#sub-app-trial" class="link-inline">App Trial</a>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >02</span
                >
                <a href="#sub-one-plan" class="link-inline">Minimal One Plan</a>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >03</span
                >
                <a href="#sub-two-plans" class="link-inline"
                  >Minimal Two Plans</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >04</span
                >
                <a href="#sub-multi-cycle" class="link-inline">Multi-Cycle</a>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >05</span
                >
                <a href="#sub-catalog-driven" class="link-inline"
                  >Individual / Teams</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >06</span
                >
                <a href="#sub-unit-auto" class="link-inline">Unit-Based</a>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >07</span
                >
                <a href="#sub-grouped-cycles" class="link-inline"
                  >Grouped Multi-Cycle</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >08</span
                >
                <a href="#sub-consent-gates" class="link-inline"
                  >Consent Gates</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >09</span
                >
                <a href="#sub-custom-composition" class="link-inline"
                  >Custom Composition</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >10</span
                >
                <a href="#sub-typed-binding" class="link-inline"
                  >Typed Binding API</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >11</span
                >
                <a href="#sub-period-end" class="link-inline"
                  >Period-End Change</a
                >
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <p class="label-m text-foreground-placeholder">ONE TIME PURCHASE</p>
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >12</span
                >
                <a href="#onetime-single" class="link-inline">Single Product</a>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >13</span
                >
                <a href="#onetime-group" class="link-inline"
                  >Product Group + Upgrade</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >14</span
                >
                <a href="#onetime-repeat" class="link-inline"
                  >Consumable (Repeating)</a
                >
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <p class="label-m text-foreground-placeholder">ACCOUNT</p>
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >15</span
                >
                <a href="#payment-recovery" class="link-inline"
                  >Payment Recovery</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >16</span
                >
                <a href="#billing-history" class="link-inline"
                  >Billing History</a
                >
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
                  >17</span
                >
                <a href="#feature-usage-gate" class="link-inline"
                  >Feature / Usage Gate</a
                >
              </div>
            </div>
          </div>
          <a
            href="https://github.com/armitage-labs/creem/tree/main/packages/convex"
            target="_blank"
            rel="noopener noreferrer"
            class="button-outline inline-flex items-center justify-center gap-2"
          >
            <GithubIcon class="size-4" />
            <span>Github</span>
          </a>
        </nav>
      </div>
    </header>

    <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 space-y-14 pt-14">
      <CheckoutSuccessSummary
        class="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
      />

      <!-- Test card info -->
      <div
        class="rounded-lg border border-surface-300-700 bg-surface-100-900 px-4 py-3 text-sm text-foreground-muted"
      >
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="font-medium text-foreground-default">Test cards:</span>
          {#each TEST_CARDS as card (card.number)}
            <span class="inline-flex items-center gap-1.5">
              <button
                type="button"
                title={`Copy card number (${card.behavior.toLowerCase()})`}
                onclick={() => copyTestCard(card.number)}
                class="inline-flex items-center gap-1.5 rounded bg-surface-200-800 px-1.5 py-0.5 font-mono text-xs hover:bg-surface-300-700"
              >
                <span>{card.number}</span>
                {#if copiedCard === card.number}
                  <CheckIcon class="size-3 text-emerald-600" />
                {:else}
                  <CopyIcon class="size-3 opacity-60" />
                {/if}
              </button>
              <span class="text-foreground-placeholder">{card.behavior}</span>
            </span>
          {/each}
        </div>
        <div class="mt-1 text-foreground-placeholder">
          Any future expiry, any CVC, any cardholder name.
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 01: App-owned no-card trial with once-per-entity eligibility
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-app-trial"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">01 — Subscription</span
              ><br />
              App Trial + Free + Paid
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              A no-card trial is an app-owned plan. The widget activates it via
              your Convex mutation, records once-per-entity history in the
              component, and hides it after it has already been used.
            </p>
          </div>

          <div class="mt-10">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["trial", "free", "pro"])}
            />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 02: Minimal — one catalog plan
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-one-plan"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">02 — Subscription</span
              ><br />
              Minimal One Plan
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              The smallest catalog-driven subscription widget: one root, one
              plan slug, default UI. Product IDs stay in the catalog so this
              markup is stable across test and production.
            </p>
          </div>

          <div class="mt-10">
            <Subscription.Root plans={plansOf(billingCatalog, ["pro"])} />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 03: Minimal — two catalog plans
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-two-plans"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">03 — Subscription</span
              ><br />
              Minimal Two Plans
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              A compact default pricing section with two paid plan slugs from
              the catalog. This is the common upgrade-choice case without groups
              or interval complexity.
            </p>
          </div>

          <div class="mt-10">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["basic", "premium"])}
            />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 04: Multi-Cycle — 4 billing intervals, free + enterprise tiers
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-multi-cycle"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[104px]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[104px]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">04 — Subscription</span
              ><br />
              Multi-Cycle (4 Intervals)
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Plans with monthly, quarterly, semi-annual, and annual billing
              cycles. The interval toggle appears automatically. Includes free
              and enterprise tiers from the catalog.
            </p>
          </div>

          <div class="mt-10">
            <Subscription.Root
              plans={plansOf(billingCatalog, [
                "free",
                "basic-multi-cycle",
                "premium-multi-cycle",
                "enterprise",
              ])}
            />
          </div>

          <div class="flex justify-center pt-16">
            <BillingPortal class="button-faded" />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 05: Catalog-Driven with Groups — individual vs teams
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-catalog-driven"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">05 — Subscription</span
              ><br />
              Catalog-Driven with Groups
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Plans defined in a catalog. Group selector segments plans by
              audience (Individual vs Teams). Team plans use unit-based pricing
              with a visible unit picker.
            </p>
          </div>

          <div class="mt-[6.5rem]">
            <Subscription.Root
              showUnitPicker
              groups={[
                {
                  value: "individual",
                  label: "Individual",
                  plans: plansOf(billingCatalog, [
                    "basic-individual-cycle",
                    "premium-individual-cycle",
                  ]),
                },
                {
                  value: "teams",
                  label: "Teams",
                  plans: plansOf(billingCatalog, [
                    "basic-team-cycle",
                    "premium-team-cycle",
                  ]),
                },
              ]}
            />
          </div>

          <div class="flex justify-center pt-16">
            <BillingPortal class="button-faded" />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 06: Unit-Based (Auto-Derived) — no unit picker, programmatic qty
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-unit-auto"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">06 — Subscription</span
              ><br />
              Unit-Based (Auto-Derived)
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Unit-based pricing with a fixed quantity derived from your app
              data. No picker shown — the unit count is set programmatically.
              Hardcoded to 5 in this demo. Uses <code>columns={2}</code> for a
              fixed two-column display.
            </p>
          </div>

          <div class="mt-[6.5rem]">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["basic-team", "premium-team"])}
              units={5}
              columns={2}
            />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 07: Multi-cycle subscription plans with groups
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-grouped-cycles"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">07 — Subscription</span
              ><br />
              Grouped Multi-Cycle
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Group selection and interval selection compose inside the billing
              widget. The active group controls which plans are visible and
              which billing cycles are available.
            </p>
          </div>

          <div class="mt-[6.5rem]">
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

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 08: Consent Gates — checkbox policy gate before checkout or plan changes
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-consent-gates"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">08 — Subscription</span
              ><br />
              Consent Gates
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Demonstrates <code>onBeforeCheckout</code>,
              <code>onBeforePlanChange</code>, and
              <code>onBeforePlanActivation</code> with an app-owned policy
              checkbox. Checkout and plan changes continue only after consent is
              accepted.
            </p>
          </div>

          <div class="mt-12 flex flex-col items-center gap-2">
            <label class="body-m flex items-center gap-3 text-foreground-default">
              <input
                type="checkbox"
                class="h-4 w-4"
                bind:checked={consentAccepted}
                onchange={() => {
                  if (consentAccepted) consentError = "";
                }}
              />
              <span>I accept the billing policy for this demo.</span>
            </label>
            {#if consentError}
              <p class="body-s text-red-500">{consentError}</p>
            {/if}
          </div>

          <div class="mt-12">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["free", "basic", "premium"])}
              {onBeforeCheckout}
              {onBeforePlanChange}
              {onBeforePlanActivation}
            />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 09: Custom composition — app-owned layout and copy
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-custom-composition"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">09 — Subscription</span
              ><br />
              Custom Composition
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              The app controls layout, labels, and feature copy while the widget
              still owns Creem prices, active-plan state, checkout, plan
              switches, and interval changes.
            </p>
          </div>

          <div class="mt-[6.5rem]">
            <Subscription.Root
              unstyled
              groupSelector="external"
              intervalSelector="external"
              groups={[
                {
                  value: "individual",
                  label: "Individual",
                  plans: plansOf(billingCatalog, [
                    "basic-individual-cycle",
                    "premium-individual-cycle",
                  ]),
                },
                {
                  value: "teams",
                  label: "Teams",
                  plans: plansOf(billingCatalog, [
                    "basic-team-cycle",
                    "premium-team-cycle",
                  ]),
                },
              ]}
            >
              <div
                class="mb-10 flex flex-col items-center justify-between gap-4 md:flex-row"
              >
                <Subscription.GroupSelector class={detailedSelectorClass} />
                <Subscription.IntervalSelector class={detailedSelectorClass} />
              </div>

              <Subscription.Group value="individual" label="Individual">
                <Subscription.Grid
                  class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2"
                >
                  <Subscription.Item
                    planId="basic-individual-cycle"
                    class="relative flex min-h-[320px] flex-col justify-between rounded-lg border border-border-subtle bg-surface-base p-6"
                  >
                    <div class="space-y-5">
                      <Subscription.ItemBadge
                        label="Für Einzelpersonen"
                        class="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      />
                      <div class="space-y-2">
                        <Subscription.ItemTitle
                          class="heading-s text-foreground-default"
                        />
                        <Subscription.ItemDescription
                          class="body-m text-foreground-muted"
                        />
                      </div>
                      <Subscription.ItemPrice
                        class="display-s text-foreground-default"
                      />
                      <ul class="body-m space-y-2 text-foreground-default">
                        <li>Personal workspace</li>
                        <li>Basic automations</li>
                        <li>Community support</li>
                      </ul>
                    </div>
                    <Subscription.ItemCTA
                      class="button-filled mt-8 w-full disabled:cursor-not-allowed disabled:opacity-60"
                      checkoutLabel="Start individual"
                      switchLabel="Switch to individual"
                    />
                    <Subscription.Cancel class="button-outline mt-2 w-full" />
                  </Subscription.Item>

                  <Subscription.Item
                    planId="premium-individual-cycle"
                    class="relative flex min-h-[320px] flex-col justify-between rounded-lg border-2 border-primary-border-default bg-surface-base p-6"
                  >
                    <div class="space-y-5">
                      <Subscription.ItemBadge
                        label="Popular"
                        class="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      />
                      <div class="space-y-2">
                        <Subscription.ItemTitle
                          class="heading-s text-foreground-default"
                        />
                        <Subscription.ItemDescription
                          class="body-m text-foreground-muted"
                        />
                      </div>
                      <Subscription.ItemPrice
                        class="display-s text-foreground-default"
                      />
                      <ul class="body-m space-y-2 text-foreground-default">
                        <li>Unlimited personal projects</li>
                        <li>Priority support</li>
                        <li>Advanced usage limits</li>
                      </ul>
                    </div>
                    <Subscription.ItemCTA
                      class="button-filled mt-8 w-full disabled:cursor-not-allowed disabled:opacity-60"
                      checkoutLabel="Go premium"
                      switchLabel="Switch to premium"
                    />
                    <Subscription.Cancel class="button-outline mt-2 w-full" />
                  </Subscription.Item>
                </Subscription.Grid>
              </Subscription.Group>

              <Subscription.Group value="teams" label="Teams">
                <Subscription.Grid
                  class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2"
                >
                  <Subscription.Item
                    planId="basic-team-cycle"
                    class="relative flex min-h-[320px] flex-col justify-between rounded-lg border border-border-subtle bg-surface-base p-6"
                  >
                    <div class="space-y-5">
                      <Subscription.ItemBadge
                        label="Teams"
                        class="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                      />
                      <div class="space-y-2">
                        <Subscription.ItemTitle
                          class="heading-s text-foreground-default"
                        />
                        <Subscription.ItemDescription
                          class="body-m text-foreground-muted"
                        />
                      </div>
                      <Subscription.ItemPrice
                        class="display-s text-foreground-default"
                      />
                      <Subscription.ItemPriceCaption
                        class="body-m text-foreground-muted"
                      />
                      <Subscription.UnitPicker
                        detailed
                        class="flex w-full flex-col gap-2"
                        rowClass="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2"
                        labelClass="label-m text-foreground-default"
                        actionsClass="flex w-full items-center gap-2"
                        secondaryClass="button-faded h-8 w-full"
                        primaryClass="button-filled h-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <ul class="body-m space-y-2 text-foreground-default">
                        <li>Shared billing for every unit</li>
                        <li>Team workspace</li>
                        <li>Role-based access</li>
                      </ul>
                    </div>
                    <Subscription.ItemCTA
                      class="button-filled mt-8 w-full disabled:cursor-not-allowed disabled:opacity-60"
                      checkoutLabel="Start team plan"
                      switchLabel="Switch team plan"
                    />
                    <Subscription.Cancel class="button-outline mt-2 w-full" />
                  </Subscription.Item>

                  <Subscription.Item
                    planId="premium-team-cycle"
                    class="relative flex min-h-[320px] flex-col justify-between rounded-lg border-2 border-primary-border-default bg-surface-base p-6"
                  >
                    <div class="space-y-5">
                      <Subscription.ItemBadge
                        label="Best for teams"
                        class="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      />
                      <div class="space-y-2">
                        <Subscription.ItemTitle
                          class="heading-s text-foreground-default"
                        />
                        <Subscription.ItemDescription
                          class="body-m text-foreground-muted"
                        />
                      </div>
                      <Subscription.ItemPrice
                        class="display-s text-foreground-default"
                      />
                      <Subscription.ItemPriceCaption
                        class="body-m text-foreground-muted"
                      />
                      <Subscription.UnitPicker
                        detailed
                        class="flex w-full flex-col gap-2"
                        rowClass="flex w-full items-center justify-between rounded-xl bg-surface-subtle py-2 pl-4 pr-2"
                        labelClass="label-m text-foreground-default"
                        actionsClass="flex w-full items-center gap-2"
                        secondaryClass="button-faded h-8 w-full"
                        primaryClass="button-filled h-8 w-full disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <ul class="body-m space-y-2 text-foreground-default">
                        <li>Advanced team controls</li>
                        <li>Higher usage limits</li>
                        <li>Priority team support</li>
                      </ul>
                    </div>
                    <Subscription.ItemCTA
                      class="button-filled mt-8 w-full disabled:cursor-not-allowed disabled:opacity-60"
                      checkoutLabel="Upgrade team"
                      switchLabel="Switch team plan"
                    />
                    <Subscription.Cancel class="button-outline mt-2 w-full" />
                  </Subscription.Item>
                </Subscription.Grid>
              </Subscription.Group>
            </Subscription.Root>
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 10: Typed Binding API — createCreemSvelte with typed planIds
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-typed-binding"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">10 — Subscription</span
              ><br />
              Typed Binding API
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Uses <code>createCreemSvelte</code> to bind catalog + API refs
              into a single typed object. The typed binding feeds
              <code>CreemConvexProvider</code>, and the widget receives typed
              plan IDs without direct API props.
            </p>
          </div>

          <CreemConvexProvider
            api={billing.api}
            catalog={billing.catalog}
            defaultCycle={billing.defaultCycle}
          >
            <div class="mt-[6.5rem]">
              <Subscription.Root plans={billing.planIds} />
            </div>

            <div class="flex justify-center pt-16">
              <BillingPortal class="button-faded" />
            </div>
          </CreemConvexProvider>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 11: Subscription — period-end scheduled update
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-period-end"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">11 — Subscription</span
              ><br />
              Period-End Plan Change
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Uses dedicated products and an <code>updateBehavior</code> resolver.
              Paid downgrades stay active until period end, free-plan switches
              use the dedicated cancellation behavior, and upgrades use Creem
              proration on the next invoice.
            </p>
          </div>

          <div class="mt-[6.5rem]">
            <Subscription.Root
              updateBehavior={(intent: UpdateBehaviorIntent) => {
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

          <div class="flex justify-center pt-16">
            <BillingPortal class="button-faded" />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 12: One-Time Purchase — single product
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="onetime-single"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder"
                >12 — One Time Purchase</span
              ><br />
              Single Product
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              A single product purchased once. After purchase, the card shows an
              "Owned" badge.
            </p>
          </div>

          {#if env.onetimeSingle}
            <div class="mt-[6.5rem]">
              <Product.Root layout="single" styleVariant="pricing">
                <Product.Item
                  type="one-time"
                  title="Lifetime Access"
                  productId={env.onetimeSingle}
                />
              </Product.Root>
            </div>
          {:else}
            <p class="mt-10 text-center text-foreground-muted">
              Set <code>VITE_CREEM_ONETIME_SINGLE</code> to enable this demo.
            </p>
          {/if}
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 13: One-Time Purchase — mutually exclusive group with upgrade
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="onetime-group"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder"
                >13 — One Time Purchase</span
              ><br />
              Product Group + Upgrade
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Mutually exclusive products with an upgrade transition graph.
              Upgrading from Basic to Premium uses a dedicated delta product.
              Product images are synced from Creem.
            </p>
          </div>

          {#if env.onetimeBasic && env.onetimePremium}
            <div class="mt-[6.5rem]">
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
          {:else}
            <p class="mt-10 text-center text-foreground-muted">
              Set <code>VITE_CREEM_ONETIME_BASIC</code> and
              <code>VITE_CREEM_ONETIME_PREMIUM</code> to enable this demo.
            </p>
          {/if}
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 14: One-Time Purchase — repeating (consumable)
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="onetime-repeat"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder"
                >14 — One Time Purchase</span
              ><br />
              Consumable (Repeating)
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              A consumable product purchasable repeatedly (credits, tokens). The
              buy button stays active after every purchase — no "Owned" badge.
            </p>
          </div>

          {#if env.onetimeCredits}
            <div class="mt-[6.5rem]">
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

            <div class="mt-12 flex justify-center">
              <Credits.Root unitLabel="credits">
                {#snippet children(credits: CreditsContextValue)}
                  <div class="flex items-center justify-between gap-3">
                    <Credits.Title>Credit Balance</Credits.Title>
                    <Credits.Refresh />
                  </div>
                  <Credits.Amount />
                  <Credits.Error />

                  {#if demoImageMessage}
                    <div class="label-s text-success-foreground-default">
                      {demoImageMessage}
                    </div>
                  {/if}
                  {#if demoImageError}
                    <div
                      class="body-m radius-m border border-error-border-subtle bg-error-surface-subtle px-3 py-2 text-error-foreground-default"
                    >
                      {demoImageError}
                    </div>
                  {/if}

                  <button
                    class="button-filled h-10 w-full disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                    onclick={() => generateDemoImage(credits.refresh)}
                    disabled={demoImageLoading}
                  >
                    {demoImageLoading
                      ? "Generating..."
                      : "Generate image (10 credits)"}
                  </button>
                {/snippet}
              </Credits.Root>
            </div>
          {:else}
            <p class="mt-10 text-center text-foreground-muted">
              Set <code>VITE_CREEM_ONETIME_CREDITS</code> to enable this demo.
            </p>
          {/if}
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 15: Payment Recovery — banner + button
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="payment-recovery"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">15 — Account</span><br
              />
              Payment Recovery
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              <code>PaymentRecoveryBanner</code> auto-detects payment issues
              from subscription state.
              <code>PaymentRecoveryButton</code> opens the customer portal for payment
              method updates. The demo backend also uses scheduled cancellation,
              so canceling a subscription keeps access until period end and surfaces
              the <code>subscription.scheduled_cancel</code> state.
              (Shown with forced "warning" state for demo purposes.)
            </p>
          </div>

          <div class="mt-[6.5rem] space-y-4 max-w-xl mx-auto">
            <PaymentRecoveryBanner recoveryState="warning" />
            <PaymentRecoveryBanner recoveryState="blocked" />
            <PaymentRecoveryButton
              portalUrl={connectedApi.customers!.portalUrl!}
            />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 16: Billing History
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="billing-history"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">16 — Account</span><br
              />
              Billing History
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              Paginated transaction history sourced from Creem. Invoice and
              receipt documents are not included in this transaction view.
            </p>
          </div>

          <div class="mt-[6.5rem]">
            <BillingHistory pageSize={5} />
          </div>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 17: Feature / Usage Gate
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="feature-usage-gate"
        class="relative left-1/2 -translate-x-1/2 w-screen pb-[6.5rem]"
      >
        <div class="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">17 — Account</span><br
              />
              Feature / Usage Gate
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              App-owned usage counters are evaluated against catalog limits.
              Billing state gates feature access, while the app stays
              responsible for measuring actual usage.
            </p>
          </div>

          <div class="mx-auto mt-[6.5rem] grid max-w-3xl gap-4 md:grid-cols-2">
            <div
              class="rounded-lg border border-border-subtle bg-surface-base p-5"
            >
              <p class="label-m text-foreground-placeholder">Current usage</p>
              <div class="mt-4 space-y-3">
                <div>
                  <div
                    class="flex items-center justify-between body-m text-foreground-default"
                  >
                    <span>AI messages</span>
                    <span
                      >{usageLimits.aiMessages.used} / {usageLimits.aiMessages
                        .limit}</span
                    >
                  </div>
                  <div
                    class="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"
                  >
                    <div
                      class={`h-full rounded-full ${usageLimits.aiMessages.exceeded ? "bg-red-500" : "bg-primary-border-default"}`}
                      style={`width: ${Math.min(100, (usageLimits.aiMessages.used / usageLimits.aiMessages.limit) * 100)}%`}
                    ></div>
                  </div>
                </div>
                <div>
                  <div
                    class="flex items-center justify-between body-m text-foreground-default"
                  >
                    <span>Projects</span>
                    <span
                      >{usageLimits.projects.used} / {usageLimits.projects
                        .limit}</span
                    >
                  </div>
                  <div
                    class="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle"
                  >
                    <div
                      class={`h-full rounded-full ${usageLimits.projects.exceeded ? "bg-red-500" : "bg-primary-border-default"}`}
                      style={`width: ${Math.min(100, (usageLimits.projects.used / usageLimits.projects.limit) * 100)}%`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="rounded-lg border border-border-subtle bg-surface-base p-5"
            >
              <p class="label-m text-foreground-placeholder">Feature gate</p>
              <div class="mt-4">
                <BillingGate
                  snapshot={snapshot}
                  requiredActions="portal"
                >
                  <div
                    class="rounded-lg bg-emerald-50 p-4 body-m text-emerald-900"
                  >
                    Billing management is available for this account.
                  </div>
                  {#snippet fallback()}
                    <div
                      class="rounded-lg bg-surface-subtle p-4 body-m text-foreground-muted"
                    >
                      Billing management is hidden until this account has portal
                      access.
                    </div>
                  {/snippet}
                </BillingGate>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</CreemConvexProvider>
