import {
  CheckoutSuccessSummary,
  BillingPortal,
  Product,
  Subscription,
  type ConnectedBillingApi,
  type Transition,
} from "@mmailaender/convex-creem/react";
import { api } from "../../convex/_generated/api";
import creemLogoUrl from "./assets/creem.svg";
import convexLogoUrl from "./assets/convex.svg";
import { GithubIcon } from "lucide-react";

const connectedApi: ConnectedBillingApi = {
  uiModel: api.billing.uiModel,
  checkouts: {
    create: api.billing.checkoutsCreate,
  },
  subscriptions: {
    update: api.billing.subscriptionsUpdate,
    cancel: api.billing.subscriptionsCancel,
    resume: api.billing.subscriptionsResume,
  },
  customers: {
    portalUrl: api.billing.customersPortalUrl,
  },
};

const upgradeTransitions: Transition[] = [
  {
    from: "prod_4Di7Lkhf3TXy4UOKsUrGw0",
    to: "prod_56sJIyL7piLCVv270n4KBz",
    kind: "via_product",
    viaProductId: "prod_5LApsYRX8dHbx8QuLJgJ3j",
  },
];

export default function App() {
  return (
    <main className="w-full py-10 lg:pt-16">
      <header className="border-b border-border-subtle pb-16 lg:pb-[104px]">
        <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-2">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="display-m max-w-[720px] text-foreground-default">
              Drop-in Billing for Convex Apps
            </h1>
            <p className="subtitle-m max-w-[720px] text-foreground-default">
              Subscriptions, one-time purchases, seat-based pricing, and a
              customer portal — all powered by Creem and wired to your Convex
              backend. Available for React and Svelte.
            </p>
            <div className="pt-8 text-foreground-placeholder">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-8 items-center justify-center opacity-70">
                  <img src={creemLogoUrl} alt="Creem" className="h-7 w-auto" />
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
                  <a href="#subscription-with-trial" className="link-inline">
                    With Trial (4 Cycles)
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                    02
                  </span>
                  <a href="#subscription-without-trial" className="link-inline">
                    Without Trial (Monthly Only)
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                    03
                  </span>
                  <a
                    href="#subscription-seat-selectable"
                    className="link-inline"
                  >
                    Seat-Based (User-Selectable)
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                    04
                  </span>
                  <a href="#subscription-seat-auto" className="link-inline">
                    Seat-Based (Auto-Derived)
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
                    05
                  </span>
                  <a href="#onetime-single" className="link-inline">
                    Single One-Time Product
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                    06
                  </span>
                  <a href="#onetime-group" className="link-inline">
                    Mutually Exclusive Product Group
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="label-m text-foreground-placeholder inline-block w-6 shrink-0">
                    07
                  </span>
                  <a href="#onetime-repeat" className="link-inline">
                    Repeating Product (Consumable)
                  </a>
                </div>
              </div>
            </div>
            <a
              href="https://github.com/mmailaender/convex-creem"
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
          <span className="font-medium text-foreground-default">Test card:</span>
          <code className="ml-1 rounded bg-surface-200-800 px-1.5 py-0.5 font-mono text-xs">
            4242 4242 4242 4242
          </code>
          <span className="ml-2 text-foreground-placeholder">
            — any future expiry, any CVC, any cardholder name
          </span>
        </div>

        {/* ─── Section 1: Subscriptions with trial (all 4 billing cycles) ─── */}
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
                semi-annual, and annual billing cycles — the cycle toggle appears
                automatically from the registered plans.
              </p>
            </div>

            <div className="mt-10">
              <Subscription.Root api={connectedApi} className="">
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
              <BillingPortal api={connectedApi} className="button-faded" />
            </div>
          </div>
        </section>

        {/* ─── Section 2: Subscriptions without trial (monthly only) ─── */}
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
                Monthly-only plans with no trial period. Since only one billing
                cycle is registered, the cycle toggle is hidden automatically.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Subscription.Root api={connectedApi}>
                <Subscription.Item
                  type="free"
                  title="Free"
                  description={`✔️ 1 user included\n✔️ Basic email support\n✔️ 1 GB storage\n✔️ Standard templates`}
                />
                <Subscription.Item
                  planId="basic-monthly"
                  type="single"
                  title="Basic"
                  productIds={{ "every-month": "prod_53CU7duHB58lGTUqKlRroI" }}
                />
                <Subscription.Item
                  planId="professional-monthly"
                  type="single"
                  title="Professional"
                  productIds={{ "every-month": "prod_3ymOe55fDzKgmPoZnPEOBq" }}
                />
              </Subscription.Root>
            </div>

            <div className="flex justify-center pt-16">
              <BillingPortal api={connectedApi} className="button-faded" />
            </div>
          </div>
        </section>

        {/* ─── Section 3: Seat-based subscriptions ─── */}
        <section
          id="subscription-seat-selectable"
          className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
        >
          <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
            <div className="mx-auto grid grid-cols-12">
              <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                <span className="text-foreground-placeholder">
                  Subscription
                </span>
                <br />
                Seat-Based (User-Selectable)
              </h2>
              <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                Per-seat pricing where the customer picks how many seats before
                checkout. The seat picker lets users choose their team size.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Subscription.Root api={connectedApi} showSeatPicker>
                <Subscription.Item
                  planId="basic-seat-monthly"
                  type="seat-based"
                  title="Basic"
                  productIds={{ "every-month": "prod_1c6ZGcxekHKrVYuWriHs68" }}
                />
                <Subscription.Item
                  planId="premium-seat-monthly"
                  type="seat-based"
                  title="Premium"
                  productIds={{ "every-month": "prod_3861b06bJDnvpEBcs2uxYv" }}
                />
              </Subscription.Root>
            </div>

            <div className="flex justify-center pt-16">
              <BillingPortal api={connectedApi} className="button-faded" />
            </div>
          </div>
        </section>

        {/* ─── Section 3b: Seat-based with auto-derived units ─── */}
        <section
          id="subscription-seat-auto"
          className="relative left-1/2 -translate-x-1/2 w-screen border-b border-border-subtle pb-[6.5rem]"
        >
          <div className="mx-auto w-full max-w-[1280px] px-4 lg:px-16 pt-[6.5rem]">
            <div className="mx-auto grid grid-cols-12">
              <h2 className="heading-l col-span-12 text-center text-foreground-default lg:col-start-4 lg:col-span-6">
                <span className="text-foreground-placeholder">
                  Subscription
                </span>
                <br />
                Seat-Based (Auto-Derived)
              </h2>
              <p className="body-l col-span-12 mt-6 text-center text-foreground-muted lg:col-start-4 lg:col-span-6">
                Per-seat pricing with a fixed seat count derived from your app
                (e.g. team member count). No picker is shown — the unit count is
                set programmatically. Hardcoded to 5 in this demo.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Subscription.Root api={connectedApi} units={5} twoColumnLayout>
                <Subscription.Item
                  planId="basic-seat-auto"
                  type="seat-based"
                  title="Basic"
                  productIds={{ "every-month": "prod_1c6ZGcxekHKrVYuWriHs68" }}
                />
                <Subscription.Item
                  planId="premium-seat-auto"
                  type="seat-based"
                  title="Premium"
                  productIds={{ "every-month": "prod_3861b06bJDnvpEBcs2uxYv" }}
                />
              </Subscription.Root>
            </div>
          </div>
        </section>

        {/* ─── Section 4: Standalone one-time product ─── */}
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
                A single product that can be purchased once. After purchase, the
                card displays an &ldquo;Owned&rdquo; badge instead of a buy
                button.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Product.Root
                api={connectedApi}
                layout="single"
                styleVariant="pricing"
              >
                <Product.Item
                  type="one-time"
                  title="One-time purchase"
                  productId="prod_6npEfkzgtr9hSqdWd7fqKG"
                />
              </Product.Root>
            </div>
          </div>
        </section>

        {/* ─── Section 5: Mutually exclusive product group with upgrade ─── */}
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
                A group of products where owning one affects available actions on
                others. Upgrade paths are defined via a transition graph —
                upgrading from Basic to Premium uses a dedicated delta product.
                Product images are synced from Creem.
              </p>
              <p className="body-l col-span-12 mt-2 text-center font-medium text-foreground-default lg:col-start-4 lg:col-span-6">
                Try it: Buy the Basic product first, then upgrade to Premium.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Product.Root
                api={connectedApi}
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

        {/* ─── Section 6: Repeating (consumable) product ─── */}
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
                purchase — no &ldquo;Owned&rdquo; badge is shown. Product image
                is synced from Creem.
              </p>
            </div>

            <div className="mt-[6.5rem]">
              <Product.Root
                api={connectedApi}
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
          </div>
        </section>
      </div>
    </main>
  );
}
