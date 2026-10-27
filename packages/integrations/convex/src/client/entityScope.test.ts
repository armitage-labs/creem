/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { Creem } from "./index.js";
import schema from "../component/schema.js";
import { api } from "../component/_generated/api.js";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  getConvexErrorCode,
  SHARED_CUSTOMER_ERROR_CODE,
} from "../core/convexError.js";

// Two billing entities that share one Creem customer (Creem keeps one per store
// and email address), run against the real component functions.
const modules = import.meta.glob("../component/**/*.ts");

const subscription = (id: string, entityId: string) => ({
  id,
  customerId: "cust_shared",
  productId: "prod_1",
  checkoutId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  modifiedAt: "2026-01-01T00:00:00.000Z",
  amount: 1000,
  currency: "usd",
  recurringInterval: "every-month",
  status: "active",
  currentPeriodStart: "2026-01-01T00:00:00.000Z",
  currentPeriodEnd: "2099-02-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  startedAt: "2026-01-01T00:00:00.000Z",
  endedAt: null,
  metadata: { convexBillingEntityId: entityId },
});

describe("Creem client on a customer shared by two entities", () => {
  let t: ReturnType<typeof convexTest>;
  let creem: Creem;
  let ctx: {
    runQuery: (ref: unknown, args: unknown) => Promise<unknown>;
    runMutation: (ref: unknown, args: unknown) => Promise<unknown>;
    runAction: () => Promise<void>;
  };

  beforeEach(async () => {
    t = convexTest(schema, modules);
    for (const entityId of ["user_1", "org_1"]) {
      await t.mutation(api.lib.insertCustomer, {
        id: "cust_shared",
        entityId,
      });
    }
    await t.mutation(api.lib.createSubscription, {
      subscription: subscription("sub_personal", "user_1"),
    });
    creem = new Creem(api as unknown as ComponentApi, {
      apiKey: "k",
      webhookSecret: "s",
    });
    ctx = {
      runQuery: (ref, args) =>
        t.query(
          ref as FunctionReference<"query">,
          args as Record<string, unknown>,
        ),
      runMutation: (ref, args) =>
        t.mutation(
          ref as FunctionReference<"mutation">,
          args as Record<string, unknown>,
        ),
      runAction: async () => {},
    };
  });

  it("keeps one entity's subscription out of the other's billing model", async () => {
    const org = await creem.getBillingModel(ctx as never, {
      entityId: "org_1",
    });
    const personal = await creem.getBillingModel(ctx as never, {
      entityId: "user_1",
    });

    expect(org.snapshot?.subscriptions).toEqual([]);
    expect(org.activeSubscriptions).toEqual([]);
    expect(org.subscriptionProductId).toBeNull();
    expect(personal.activeSubscriptions.map((s) => s.id)).toEqual([
      "sub_personal",
    ]);
  });

  it("refuses subscription commands on the other entity's subscription", async () => {
    await expect(
      creem.subscriptions.cancel(ctx as never, {
        entityId: "org_1",
        subscriptionId: "sub_personal",
      }),
    ).rejects.toThrow("Subscription not found");
    await expect(
      creem.subscriptions.cancel(ctx as never, { entityId: "org_1" }),
    ).rejects.toThrow("Subscription not found");
  });

  it("reports the customer as shared and refuses the billing email change", async () => {
    expect(
      await creem.customers.isShared(ctx as never, { entityId: "org_1" }),
    ).toBe(true);
    await expect(
      creem.customers.updateBillingEmail(ctx as never, {
        entityId: "org_1",
        email: "billing@example.com",
      }),
    ).resolves.toEqual({ status: "shared-customer" });
  });

  it("refuses the customer portal while the customer is shared", async () => {
    const generateBillingLinks = vi.fn(async () => ({
      customerPortalLink: "https://portal.example/shared",
    }));
    creem.sdk.customers.generateBillingLinks = generateBillingLinks as never;

    const refusal = await creem.customers
      .portalUrl(ctx as never, { entityId: "org_1" })
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ConvexError);
    expect(getConvexErrorCode(refusal)).toBe(SHARED_CUSTOMER_ERROR_CODE);
    expect(generateBillingLinks).not.toHaveBeenCalled();
  });

  it("opens the portal for a customer only one entity touches", async () => {
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_solo",
      entityId: "user_2",
    });
    creem.sdk.customers.generateBillingLinks = vi.fn(async () => ({
      customerPortalLink: "https://portal.example/solo",
    })) as never;

    await expect(
      creem.customers.portalUrl(ctx as never, { entityId: "user_2" }),
    ).resolves.toEqual({ url: "https://portal.example/solo" });
  });
});
