/// <reference types="vite/client" />
import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import type { Infer } from "convex/values";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = import.meta.glob("./**/*.ts");

type DbSubscription = Infer<typeof schema.tables.subscriptions.validator>;
type DbOrder = Infer<typeof schema.tables.orders.validator>;

// Creem keeps one customer per store and email address, so a person who checks
// out for a personal account and for an organization ends up with one Creem
// customer mapped to two billing entities.
const CUSTOMER = "cust_shared";
const PERSONAL = "user_1";
const ORG = "org_1";

const subscription = (
  id: string,
  metadata: Record<string, unknown>,
): DbSubscription => ({
  id,
  customerId: CUSTOMER,
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
  metadata,
});

const order = (id: string, metadata?: Record<string, unknown>): DbOrder => ({
  id,
  customerId: CUSTOMER,
  productId: "prod_once",
  amount: 500,
  currency: "usd",
  status: "paid",
  type: "onetime",
  metadata,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe("entity-scoped billing data on a shared Creem customer", () => {
  let t: TestConvex<typeof schema>;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    for (const entityId of [PERSONAL, ORG]) {
      await t.mutation(api.lib.insertCustomer, { id: CUSTOMER, entityId });
    }
  });

  const addSubscription = (row: DbSubscription) =>
    t.mutation(api.lib.createSubscription, { subscription: row });
  const addOrder = (row: DbOrder) =>
    t.mutation(api.lib.createOrder, { order: row });

  it("lists the entities mapped to the customer", async () => {
    const entities = await t.query(api.lib.listCustomerEntities, {
      customerId: CUSTOMER,
    });
    expect(entities.sort()).toEqual([ORG, PERSONAL]);
  });

  it("returns each entity only its own subscriptions and orders", async () => {
    await addSubscription(
      subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
    );
    await addSubscription(
      subscription("sub_org", { convexBillingEntityId: ORG }),
    );
    await addOrder(order("ord_personal", { convexBillingEntityId: PERSONAL }));
    await addOrder(order("ord_org", { convexBillingEntityId: ORG }));

    for (const [entityId, own] of [
      [PERSONAL, "personal"],
      [ORG, "org"],
    ] as const) {
      expect(
        ids(await t.query(api.lib.listAllUserSubscriptions, { entityId })),
      ).toEqual([`sub_${own}`]);
      expect(
        ids(await t.query(api.lib.listUserSubscriptions, { entityId })),
      ).toEqual([`sub_${own}`]);
      expect(
        (await t.query(api.lib.getCurrentSubscription, { entityId }))?.id,
      ).toBe(`sub_${own}`);
      expect(ids(await t.query(api.lib.listUserOrders, { entityId }))).toEqual([
        `ord_${own}`,
      ]);
    }
  });

  it("resolves an explicit subscription only inside its entity", async () => {
    await addSubscription(
      subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
    );

    expect(
      await t.query(api.lib.getEntitySubscription, {
        entityId: ORG,
        id: "sub_personal",
      }),
    ).toBeNull();
    expect(
      (
        await t.query(api.lib.getEntitySubscription, {
          entityId: PERSONAL,
          id: "sub_personal",
        })
      )?.id,
    ).toBe("sub_personal");
  });

  it("has no current subscription for an entity whose customer pays only for another", async () => {
    await addSubscription(
      subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
    );

    expect(
      await t.query(api.lib.getCurrentSubscription, { entityId: ORG }),
    ).toBeNull();
  });

  describe("legacy rows without convexBillingEntityId", () => {
    it("belong to the entity while no row names another entity", async () => {
      const single = convexTest(schema, modules);
      await single.mutation(api.lib.insertCustomer, {
        id: CUSTOMER,
        entityId: PERSONAL,
      });
      await single.mutation(api.lib.createSubscription, {
        subscription: subscription("sub_legacy", {}),
      });
      await single.mutation(api.lib.createOrder, {
        order: order("ord_legacy"),
      });

      expect(
        ids(
          await single.query(api.lib.listAllUserSubscriptions, {
            entityId: PERSONAL,
          }),
        ),
      ).toEqual(["sub_legacy"]);
      expect(
        ids(await single.query(api.lib.listUserOrders, { entityId: PERSONAL })),
      ).toEqual(["ord_legacy"]);
    });

    it("belong to the entity named by the customer's other rows", async () => {
      await addSubscription(subscription("sub_legacy", {}));
      await addSubscription(
        subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
      );

      expect(
        ids(
          await t.query(api.lib.listAllUserSubscriptions, {
            entityId: PERSONAL,
          }),
        ),
      ).toEqual(["sub_legacy", "sub_personal"]);
      expect(
        await t.query(api.lib.listAllUserSubscriptions, { entityId: ORG }),
      ).toEqual([]);
    });

    it("belong to no entity once the customer's rows name two", async () => {
      await addSubscription(subscription("sub_legacy", {}));
      await addOrder(order("ord_legacy"));
      await addSubscription(
        subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
      );
      await addOrder(order("ord_org", { convexBillingEntityId: ORG }));

      expect(
        ids(
          await t.query(api.lib.listAllUserSubscriptions, {
            entityId: PERSONAL,
          }),
        ),
      ).toEqual(["sub_personal"]);
      expect(
        ids(await t.query(api.lib.listUserOrders, { entityId: ORG })),
      ).toEqual(["ord_org"]);
      expect(
        await t.query(api.lib.getEntitySubscription, {
          entityId: PERSONAL,
          id: "sub_legacy",
        }),
      ).toBeNull();
    });
  });
});
