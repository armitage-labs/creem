/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { Creem } from "./index.js";
import schema from "../component/schema.js";
import { api } from "../component/_generated/api.js";
import type { ComponentApi } from "../component/_generated/component.js";

// Runs `updateBillingEmail` against the real component functions, so the
// ordering below exercises the mirror's freshness check end to end.
const modules = import.meta.glob("../component/**/*.ts");

type Gate = { wait: Promise<void>; open: () => void };
const gate = (): Gate => {
  let open: () => void = () => {};
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
};

describe("billing email mirror with overlapping saves", () => {
  let t: ReturnType<typeof convexTest>;
  let creem: Creem;
  let ctx: {
    runQuery: (ref: unknown, args: unknown) => Promise<unknown>;
    runMutation: (ref: unknown, args: unknown) => Promise<unknown>;
    runAction: () => Promise<void>;
  };
  // Creem's side: the current address and a millisecond `updated_at` clock.
  let creemEmail: string;
  let clock: number;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    await t.mutation(api.lib.insertCustomer, {
      id: "cust_1",
      entityId: "org_1",
      email: "old@example.com",
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
    creemEmail = "old@example.com";
    clock = Date.parse("2026-03-01T10:00:00.000Z");
  });

  const stub = (holdReadbackOf?: { email: string; gate: Gate }) => {
    creem.sdk.customers.update = vi.fn(async ({ email }: { email: string }) => {
      creemEmail = email;
      clock += 1000;
      return { id: "cust_1", email };
    }) as never;
    creem.sdk.customers.retrieve = vi.fn(async () => {
      // The readback reflects Creem at request time; only its delivery waits.
      const snapshot = {
        id: "cust_1",
        email: creemEmail,
        updatedAt: new Date(clock),
      };
      if (holdReadbackOf && snapshot.email === holdReadbackOf.email) {
        await holdReadbackOf.gate.wait;
      }
      return snapshot;
    }) as never;
  };

  const localEmail = async () =>
    (await t.query(api.lib.getCustomerByEntityId, { entityId: "org_1" }))
      ?.email;

  it("keeps the newer address when an older readback arrives last", async () => {
    // A updates and reads back, but A's readback is delayed. B updates, reads
    // back, and mirrors. A's readback then arrives and must be ignored.
    const delayed = gate();
    stub({ email: "first@example.com", gate: delayed });

    const saveA = creem.customers.updateBillingEmail(ctx as never, {
      entityId: "org_1",
      email: "first@example.com",
    });
    await vi.waitFor(() =>
      expect(creem.sdk.customers.retrieve).toHaveBeenCalledTimes(1),
    );
    await creem.customers.updateBillingEmail(ctx as never, {
      entityId: "org_1",
      email: "second@example.com",
    });
    expect(await localEmail()).toBe("second@example.com");

    delayed.open();
    await saveA;

    expect(creemEmail).toBe("second@example.com");
    expect(await localEmail()).toBe("second@example.com");
  });

  it("stores each newer readback in sequence", async () => {
    stub();

    await creem.customers.updateBillingEmail(ctx as never, {
      entityId: "org_1",
      email: "first@example.com",
    });
    await creem.customers.updateBillingEmail(ctx as never, {
      entityId: "org_1",
      email: "second@example.com",
    });

    expect(await localEmail()).toBe("second@example.com");
  });
});
