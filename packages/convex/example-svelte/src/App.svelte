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
    TrialLimitBanner,
    PaymentRecoveryButton,
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
  import {
    billingCatalog,
    env,
  } from "../../example-shared/billingCatalog.js";
  import creemLogoUrl from "./assets/creem.svg";
  import convexLogoUrl from "./assets/convex.svg";
  import { CheckIcon, CopyIcon, GithubIcon } from "@lucide/svelte";

  // ────────────────────────────────────────────────────────────────────────────
  // Connected API — Convex function references
  // ────────────────────────────────────────────────────────────────────────────

  // One call maps every generated `convex/billing.ts` export onto the widget
  // API. Exports you leave out simply hide the matching controls, and a wrong
  // or missing export is a compile error rather than a runtime surprise.
  const connectedApi: ConnectedBillingApi = connectCreemApi(api.billing);

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

  const TOC = [
  {
    title: "SUBSCRIPTION VARIANTS",
    items: [
      { n: "01", href: "#sub-one-plan", label: "Minimal One Plan" },
      { n: "02", href: "#sub-two-plans", label: "Minimal Two Plans" },
      { n: "03", href: "#sub-app-trial", label: "App Trial" },
      { n: "04", href: "#sub-multi-cycle", label: "Creem Trial + Multi-Cycle" },
      { n: "05", href: "#sub-catalog-driven", label: "Individual / Teams" },
      { n: "06", href: "#sub-unit-auto", label: "Unit-Based" },
      { n: "07", href: "#sub-grouped-cycles", label: "Grouped Multi-Cycle" },
      { n: "08", href: "#sub-consent-gates", label: "Consent Gates" },
      { n: "09", href: "#sub-custom-composition", label: "Custom Composition" },
      { n: "10", href: "#sub-typed-binding", label: "Typed Binding API" },
      { n: "11", href: "#sub-period-end", label: "Period-End Change" },
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

</script>

{#snippet tocGroups()}
  {#each TOC as group (group.title)}
    <div class="space-y-4">
      <p class="label-m text-foreground-placeholder {TOC_TITLE}">
        {group.title}
      </p>
      <div class="space-y-1">
        {#each group.items as item (item.href)}
          <div class="flex items-center gap-3">
            <span
              class="label-m text-foreground-placeholder inline-block w-6 shrink-0"
              >{item.n}</span
            >
            <a href={item.href} class="link-inline whitespace-nowrap"
              >{item.label}</a
            >
          </div>
        {/each}
      </div>
    </div>
  {/each}
{/snippet}

<CreemConvexProvider api={connectedApi} catalog={billingCatalog}>
  <main class="w-full py-8 lg:pt-12">
    <header class="border-b border-border-subtle pb-12 lg:pb-20">
      <div
        class="mx-auto w-full max-w-7xl px-6 lg:px-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-2"
      >
        <div class="lg:col-span-7 space-y-6">
          <h1 class="display-m max-w-180 text-foreground-default">
            Drop-in Billing for Convex Apps
          </h1>
          <p class="subtitle-m max-w-180 text-foreground-default">
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

        <div class="lg:col-start-10 lg:col-span-3 lg:pt-2">
          <a
            href="https://github.com/armitage-labs/creem/tree/main/packages/convex"
            target="_blank"
            rel="noopener noreferrer"
            class="button-outline inline-flex items-center justify-center gap-2"
          >
            <GithubIcon class="size-4" />
            <span>Github</span>
          </a>
        </div>
      </div>
    </header>

    <nav
      aria-label="Examples"
      class="group fixed right-2 top-1/2 z-40 hidden w-12 max-h-[80vh] -translate-y-1/2 space-y-8 overflow-x-hidden overflow-y-auto radius-m border border-border-subtle bg-surface-elevated p-3 shadow-md hover:w-auto focus-within:w-auto xl:block [@media(min-width:1820px)]:right-4 [@media(min-width:1820px)]:w-auto [@media(min-width:1820px)]:p-4"
    >
      {@render tocGroups()}
    </nav>

    <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 space-y-12 pt-12">
      <CheckoutSuccessSummary
        class="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
      />

      <!-- Test card info -->
      <div class="radius-m border border-border-subtle bg-surface-subtle p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="label-m text-foreground-default">Test cards</p>
          <p class="body-s text-foreground-placeholder">
            Any future expiry, any CVC, any cardholder name.
          </p>
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          {#each TEST_CARDS as card (card.number)}
            <button
              type="button"
              title={`Copy ${card.number}`}
              onclick={() => copyTestCard(card.number)}
              class="group flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-base px-3 py-2.5 text-left transition-colors hover:border-primary-border-default"
            >
              <span class="min-w-0">
                <span
                  class="block font-mono text-sm text-foreground-default tabular-nums"
                  >{card.number}</span
                >
                <span class="block body-s text-foreground-placeholder"
                  >{card.behavior}</span
                >
              </span>
              {#if copiedCard === card.number}
                <CheckIcon class="size-4 shrink-0 text-emerald-600" />
              {:else}
                <CopyIcon
                  class="size-4 shrink-0 text-foreground-placeholder opacity-0 transition-opacity group-hover:opacity-100"
                />
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 02: Minimal — one catalog plan
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-one-plan"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">01 — Subscription</span
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

          <div class="mt-12">
            <Subscription.Root plans={plansOf(billingCatalog, ["pro"])} />
          </div>
        </div>
      </section>

<!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 03: Minimal — two catalog plans
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-two-plans"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">02 — Subscription</span
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

          <div class="mt-12">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["basic", "premium"])}
            />
          </div>
        </div>
      </section>

<!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 01: App-owned no-card trial with once-per-entity eligibility
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-app-trial"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">03 — Subscription</span
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

          <div class="mt-12">
            <Subscription.Root
              plans={plansOf(billingCatalog, ["trial", "free", "pro"])}
            />
          </div>
        </div>
      </section>

<!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 04: Multi-Cycle — 4 billing intervals, free + enterprise tiers
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="sub-multi-cycle"
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
          <div class="mx-auto grid grid-cols-12">
            <h2
              class="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6"
            >
              <span class="text-foreground-placeholder">04 — Subscription</span
              ><br />
              Creem Trial + Multi-Cycle
            </h2>
            <p
              class="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6"
            >
              These Creem products carry a trial, so checkout starts one. Creem
              has no product API for trial length, so the card reads it from
              <code>trialDays</code> in the catalog. Monthly, quarterly,
              semi-annual, and annual cycles; the toggle appears automatically.
            </p>
          </div>

          <!-- TrialLimitBanner reads snapshot.subscriptions for status
               "trialing", so it only fires for a Creem-managed trial like the
               products below. An app-owned trial writes an appPlanAssignment
               instead and never reaches this banner. -->
          <div class="mx-auto mt-10 max-w-180">
            <TrialLimitBanner {snapshot} />
          </div>

          <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
            <div class="mt-12">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
              Paid downgrades stay active until period end, app-plan switches
              use the dedicated cancellation behavior, and upgrades use Creem
              proration on the next invoice.
            </p>
          </div>

          <div class="mt-12">
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
              appPlanUpdateBehavior="period-end"
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
            <div class="mt-12">
              <Product.Root layout="single" styleVariant="pricing">
                <Product.Item
                  type="one-time"
                  title="Lifetime Access"
                  productId={env.onetimeSingle}
                />
              </Product.Root>
            </div>
          {:else}
            <p class="mt-12 text-center text-foreground-muted">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
            <div class="mt-12">
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
            <p class="mt-12 text-center text-foreground-muted">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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
            <div class="mt-12">
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
            <p class="mt-12 text-center text-foreground-muted">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12 space-y-4 max-w-xl mx-auto">
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
        class="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mt-12">
            <BillingHistory pageSize={5} />
          </div>
        </div>
      </section>

<!-- ═══════════════════════════════════════════════════════════════════════════
       VARIANT 17: Feature / Usage Gate
       ═══════════════════════════════════════════════════════════════════════════ -->
      <section
        id="feature-usage-gate"
        class="relative left-1/2 -translate-x-1/2 w-screen pb-20"
      >
        <div class="mx-auto w-full max-w-7xl px-4 lg:px-16 pt-20">
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

          <div class="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
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
