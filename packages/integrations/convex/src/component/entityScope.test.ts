/// <reference types="vite/client" />
import { beforeEach, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import type { TestConvex } from "convex-test";
import type { Infer } from "convex/values";
import schema from "./schema.js";
import { api } from "./_generated/api.js";
import {
  OWNERSHIP_SCAN_LIMIT,
  preserveBillingEntity,
  withParentBillingEntity,
} from "./entityScope.js";

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

    it("belong to the only entity that maps to and names the customer", async () => {
      const single = convexTest(schema, modules);
      await single.mutation(api.lib.insertCustomer, {
        id: CUSTOMER,
        entityId: PERSONAL,
      });
      await single.mutation(api.lib.createSubscription, {
        subscription: subscription("sub_legacy", {}),
      });
      await single.mutation(api.lib.createSubscription, {
        subscription: subscription("sub_personal", {
          convexBillingEntityId: PERSONAL,
        }),
      });

      expect(
        ids(
          await single.query(api.lib.listAllUserSubscriptions, {
            entityId: PERSONAL,
          }),
        ),
      ).toEqual(["sub_legacy", "sub_personal"]);
    });

    it("belong to no entity when two entities map to the customer", async () => {
      // All rows are legacy, but the mappings already prove sharing.
      await addSubscription(subscription("sub_legacy", {}));
      await addOrder(order("ord_legacy"));

      for (const entityId of [PERSONAL, ORG]) {
        expect(
          await t.query(api.lib.listAllUserSubscriptions, { entityId }),
        ).toEqual([]);
        expect(await t.query(api.lib.listUserOrders, { entityId })).toEqual([]);
        expect(
          await t.query(api.lib.getEntitySubscription, {
            entityId,
            id: "sub_legacy",
          }),
        ).toBeNull();
      }
    });

    it("are tagged by the backfill only where the owner is unambiguous", async () => {
      await addSubscription(subscription("sub_shared_legacy", {}));
      const single = { id: "cust_single", entityId: "user_2" };
      await t.mutation(api.lib.insertCustomer, single);
      await addSubscription({
        ...subscription("sub_single_legacy", {}),
        customerId: single.id,
      });

      let cursor: string | null = null;
      let tagged = 0;
      for (;;) {
        const page: { cursor: string; isDone: boolean; tagged: number } =
          await t.mutation(api.lib.backfillBillingEntityTags, {
            cursor,
            numItems: 1,
          });
        tagged += page.tagged;
        cursor = page.cursor;
        if (page.isDone) break;
      }

      expect(tagged).toBe(1);
      expect(
        (await t.query(api.lib.getSubscription, { id: "sub_single_legacy" }))
          ?.metadata,
      ).toEqual({ convexBillingEntityId: "user_2" });
      expect(
        (await t.query(api.lib.getSubscription, { id: "sub_shared_legacy" }))
          ?.metadata,
      ).toEqual({});
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

  describe("webhooks keep the entity a row already names", () => {
    it("survives a newer subscription webhook without metadata", async () => {
      await addSubscription(
        subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
      );
      await addSubscription(
        subscription("sub_org", { convexBillingEntityId: ORG }),
      );

      const bare = {
        ...subscription("sub_personal", {}),
        modifiedAt: "2026-02-01T00:00:00.000Z",
        status: "canceled",
      };
      await t.mutation(api.lib.updateSubscription, { subscription: bare });
      await t.mutation(api.lib.createSubscription, {
        subscription: { ...bare, modifiedAt: "2026-03-01T00:00:00.000Z" },
      });

      const stored = await t.query(api.lib.getSubscription, {
        id: "sub_personal",
      });
      expect(stored?.status).toBe("canceled");
      expect(stored?.metadata).toEqual({ convexBillingEntityId: PERSONAL });
      expect(
        ids(await t.query(api.lib.listAllUserSubscriptions, { entityId: ORG })),
      ).toEqual(["sub_org"]);
    });

    it("does not let a webhook move a subscription to another entity", async () => {
      await addSubscription(
        subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
      );
      await t.mutation(api.lib.updateSubscription, {
        subscription: {
          ...subscription("sub_personal", { convexBillingEntityId: ORG }),
          modifiedAt: "2026-02-01T00:00:00.000Z",
        },
      });

      expect(
        await t.query(api.lib.getEntitySubscription, {
          entityId: ORG,
          id: "sub_personal",
        }),
      ).toBeNull();
    });

    it("survives an order update without metadata", async () => {
      await addOrder(
        order("ord_personal", { convexBillingEntityId: PERSONAL }),
      );
      await addOrder({
        ...order("ord_personal"),
        status: "refunded",
        updatedAt: "2026-02-01T00:00:00.000Z",
      });

      expect(
        (await t.query(api.lib.listUserOrders, { entityId: PERSONAL }))[0]
          ?.status,
      ).toBe("refunded");
      expect(await t.query(api.lib.listUserOrders, { entityId: ORG })).toEqual(
        [],
      );
    });
  });

  describe("sharing", () => {
    it("still counts an entity re-pointed away while its subscription stays", async () => {
      await addSubscription(
        subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
      );
      // A newer customer for PERSONAL re-points its mapping to another
      // customer; its subscription keeps billing through the shared one.
      await t.mutation(api.lib.insertCustomer, {
        id: "cust_new",
        entityId: PERSONAL,
        updatedAt: "2026-05-01T00:00:00.000Z",
      });

      expect(
        await t.query(api.lib.isCustomerShared, {
          customerId: CUSTOMER,
          entityId: ORG,
        }),
      ).toBe(true);
      expect(
        await t.query(api.lib.listCustomerEntities, { customerId: CUSTOMER }),
      ).toEqual([ORG, PERSONAL]);
    });

    it("treats a customer whose history exceeds the scan as shared", async () => {
      const single = convexTest(schema, modules);
      await single.mutation(api.lib.insertCustomer, {
        id: CUSTOMER,
        entityId: PERSONAL,
      });
      for (let index = 0; index <= OWNERSHIP_SCAN_LIMIT; index += 1) {
        await single.mutation(api.lib.createOrder, {
          order: order(`ord_${index}`, { convexBillingEntityId: PERSONAL }),
        });
      }
      await single.mutation(api.lib.createSubscription, {
        subscription: subscription("sub_legacy", {}),
      });

      expect(
        await single.query(api.lib.isCustomerShared, {
          customerId: CUSTOMER,
          entityId: PERSONAL,
        }),
      ).toBe(true);
      expect(
        await single.query(api.lib.listAllUserSubscriptions, {
          entityId: PERSONAL,
        }),
      ).toEqual([]);
    });
  });

  it("reads a tagged subscription without scanning the customer's orders", async () => {
    // Each order carries large metadata; scanning them would exceed the
    // read budget below.
    const limited = convexTest({
      schema,
      modules,
      transactionLimits: { bytesRead: 256 * 1024 },
    });
    await limited.mutation(api.lib.insertCustomer, {
      id: CUSTOMER,
      entityId: PERSONAL,
    });
    await limited.mutation(api.lib.createSubscription, {
      subscription: subscription("sub_personal", {
        convexBillingEntityId: PERSONAL,
      }),
    });
    for (let index = 0; index < 10; index += 1) {
      await limited.mutation(api.lib.createOrder, {
        order: {
          ...order(`ord_${index}`, {
            convexBillingEntityId: PERSONAL,
            note: "x".repeat(60 * 1024),
          }),
          type: "recurring",
        },
      });
    }

    expect(
      (
        await limited.query(api.lib.getCurrentSubscription, {
          entityId: PERSONAL,
        })
      )?.id,
    ).toBe("sub_personal");
    expect(
      (
        await limited.query(api.lib.getEntitySubscription, {
          entityId: PERSONAL,
          id: "sub_personal",
        })
      )?.id,
    ).toBe("sub_personal");
  });

  it("drops a scheduled update for another entity's subscription", async () => {
    // Before scoping, ORG could schedule a change to PERSONAL's subscription.
    await addSubscription(
      subscription("sub_personal", { convexBillingEntityId: PERSONAL }),
    );
    const scheduledUpdateId = await t.mutation(
      api.lib.createScheduledSubscriptionUpdate,
      {
        entityId: ORG,
        subscriptionId: "sub_personal",
        targetProductId: "prod_other",
        effectiveAt: "2026-02-01T00:00:00.000Z",
      },
    );

    await t.action(api.lib.applyScheduledSubscriptionUpdate, {
      apiKey: "k",
      scheduledUpdateId,
    });

    const update = await t.query(api.lib.getScheduledSubscriptionUpdate, {
      scheduledUpdateId,
    });
    expect(update).toMatchObject({
      status: "failed",
      error: "Subscription does not belong to the scheduled entity",
    });
    expect(
      (await t.query(api.lib.getSubscription, { id: "sub_personal" }))
        ?.productId,
    ).toBe("prod_1");
  });

  describe("metadata helpers", () => {
    it("fills an embedded payload's missing entity from its parent", () => {
      const checkout = { convexBillingEntityId: ORG, source: "app" };
      expect(withParentBillingEntity({}, checkout)).toEqual({
        convexBillingEntityId: ORG,
      });
      expect(withParentBillingEntity(undefined, checkout)).toEqual(checkout);
      expect(
        withParentBillingEntity({ convexBillingEntityId: PERSONAL }, checkout),
      ).toEqual({ convexBillingEntityId: PERSONAL });
    });

    it("keeps an established entity over incoming metadata", () => {
      const established = { convexBillingEntityId: PERSONAL, plan: "old" };
      expect(preserveBillingEntity(established, { plan: "new" })).toEqual({
        plan: "new",
        convexBillingEntityId: PERSONAL,
      });
      expect(preserveBillingEntity(undefined, { plan: "new" })).toEqual({
        plan: "new",
      });
    });
  });
});
