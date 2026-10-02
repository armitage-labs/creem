/// <reference types="vite/client" />
import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { Creem } from "./index.js";
import schema from "../component/schema.js";
import { api } from "../component/_generated/api.js";
import type { ComponentApi } from "../component/_generated/component.js";

// Signed webhooks through the real route handler, against the real component
// functions: side effects must follow the owner the stored rows accepted, not
// an owner the incoming event claims.
const modules = import.meta.glob("../component/**/*.ts");
const SECRET = "webhook-ownership-secret";

const ORG = "org_a";
const USER = "user_b";
const ORG_CUSTOMER = "cust_c";
const USER_CUSTOMER = "cust_d";

type Handler = (ctx: unknown, request: unknown) => Promise<Response>;

const sign = async (body: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const subscriptionPayload = (
  updatedAt: string,
  metadata: Record<string, unknown>,
) => ({
  id: "sub_org",
  object: "subscription",
  product: {
    id: "prod_team",
    object: "product",
    name: "Team",
    description: "Team plan",
    price: 2999,
    currency: "USD",
    billing_type: "recurring",
    billing_period: "every-month",
    status: "active",
    tax_mode: "exclusive",
    tax_category: "saas",
    default_success_url: null,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    mode: "test",
  },
  customer: {
    id: ORG_CUSTOMER,
    object: "customer",
    email: "buyer@example.com",
    name: "Buyer",
    country: "US",
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    mode: "test",
  },
  collection_method: "charge_automatically",
  status: "active",
  current_period_start_date: "2026-02-01T00:00:00.000Z",
  current_period_end_date: "2099-03-01T00:00:00.000Z",
  canceled_at: null,
  created_at: "2026-02-01T00:00:00.000Z",
  updated_at: updatedAt,
  mode: "test",
  metadata,
});

describe("webhook side effects follow the stored owner", () => {
  let t: ReturnType<typeof convexTest>;
  let handler: Handler;
  let ctx: unknown;

  const send = async (body: string) => {
    const request = {
      body: true,
      text: async () => body,
      headers: new Map([["creem-signature", await sign(body)]]),
    };
    return handler(ctx, request);
  };

  beforeEach(async () => {
    t = convexTest(schema, modules);
    await t.mutation(api.lib.insertCustomer, {
      id: ORG_CUSTOMER,
      entityId: ORG,
    });
    await t.mutation(api.lib.insertCustomer, {
      id: USER_CUSTOMER,
      entityId: USER,
    });
    await t.mutation(api.lib.createSubscription, {
      subscription: {
        id: "sub_org",
        customerId: ORG_CUSTOMER,
        productId: "prod_team",
        checkoutId: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        modifiedAt: "2026-02-01T00:00:00.000Z",
        amount: 2999,
        currency: "USD",
        recurringInterval: "every-month",
        status: "active",
        currentPeriodStart: "2026-02-01T00:00:00.000Z",
        currentPeriodEnd: "2099-03-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        startedAt: "2026-02-01T00:00:00.000Z",
        endedAt: null,
        metadata: { convexBillingEntityId: ORG },
        entityId: ORG,
      },
    });
    // The purchaser's personal account is on an app-owned plan.
    await t.mutation(api.lib.assignAppPlan, { entityId: USER, planId: "free" });

    const creem = new Creem(api as unknown as ComponentApi, {
      apiKey: "k",
      webhookSecret: SECRET,
    });
    const capture: { handler?: Handler } = {};
    creem.registerRoutes(
      {
        route: (config: { handler: { _handler: Handler } }) => {
          capture.handler = config.handler._handler;
        },
      } as never,
      { path: "/creem/events" },
    );
    handler = capture.handler as Handler;
    ctx = {
      runQuery: (ref: unknown, args: unknown) =>
        t.query(
          ref as FunctionReference<"query">,
          args as Record<string, unknown>,
        ),
      runMutation: (ref: unknown, args: unknown) =>
        t.mutation(
          ref as FunctionReference<"mutation">,
          args as Record<string, unknown>,
        ),
      runAction: async () => {},
    };
  });

  const expectUserUntouched = async () => {
    expect(
      (await t.query(api.lib.getCustomerByEntityId, { entityId: USER }))?.id,
    ).toBe(USER_CUSTOMER);
    const [plan] = await t.query(api.lib.listAppPlanAssignments, {
      entityId: USER,
    });
    expect(plan?.status).toBe("active");
    expect(
      (await t.query(api.lib.getSubscription, { id: "sub_org" }))?.entityId,
    ).toBe(ORG);
  };

  it.each([
    ["an explicit conflicting entity", { convexBillingEntityId: USER }],
    ["only the purchaser's user id", { convexUserId: USER }],
  ])("ignores %s on a subscription webhook", async (_label, metadata) => {
    const response = await send(
      JSON.stringify({
        id: "evt_sub_active",
        eventType: "subscription.active",
        created_at: 1780000000000,
        object: subscriptionPayload("2026-02-02T00:00:00.000Z", metadata),
      }),
    );

    expect(response.status).toBe(202);
    await expectUserUntouched();
  });

  it("ignores a conflicting entity on a checkout with an embedded subscription", async () => {
    const response = await send(
      JSON.stringify({
        id: "evt_checkout",
        eventType: "checkout.completed",
        created_at: 1780000000000,
        object: {
          id: "ch_conflict",
          object: "checkout",
          request_id: "req_conflict",
          product: subscriptionPayload("2026-02-02T00:00:00.000Z", {}).product,
          units: 1,
          success_url: "https://example.com/success",
          customer: subscriptionPayload("2026-02-02T00:00:00.000Z", {})
            .customer,
          subscription: subscriptionPayload("2026-02-02T00:00:00.000Z", {
            convexBillingEntityId: USER,
          }),
          status: "completed",
          mode: "test",
          metadata: { convexUserId: USER, convexBillingEntityId: USER },
        },
      }),
    );

    expect(response.status).toBe(202);
    await expectUserUntouched();
  });
});
