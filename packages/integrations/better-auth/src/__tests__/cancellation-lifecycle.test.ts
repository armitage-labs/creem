import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreemOptions, SubscriptionRecord } from "../types.js";
import {
  createMockAdapter,
  createMockContext,
  defaultOptions,
  mockDbSubscription,
  mockSubscription,
} from "./fixtures.js";
import { generateSignature } from "../utils.js";

vi.mock("better-auth/api", () => ({
  createAuthEndpoint: vi.fn((_path, _opts, handler) => handler),
  getSessionFromCtx: vi.fn(async () => ({ user: { id: "user_123" } })),
}));

import { createWebhookEndpoint } from "../webhook.js";
import { createHasAccessGrantedEndpoint } from "../has-active-subscription.js";

const periodEnd = new Date("2030-02-01T12:00:00.000Z");

function createSubscriptionStore() {
  let record: SubscriptionRecord = { ...mockDbSubscription, periodEnd };
  const adapter = createMockAdapter();
  adapter.findOne.mockImplementation(async () => record);
  adapter.findMany.mockImplementation(async () => [record]);
  adapter.update.mockImplementation(async ({ update, where = [] }) => {
    for (const condition of where) {
      if (
        condition.field === "status" &&
        condition.operator === "not_in" &&
        condition.value.includes(record.status)
      ) {
        return null;
      }
    }
    record = { ...record, ...update };
    return record;
  });
  return {
    adapter,
    get record() {
      return record;
    },
  };
}

async function deliver(
  store: ReturnType<typeof createSubscriptionStore>,
  eventType: string,
  status: typeof mockSubscription.status,
  options: CreemOptions = defaultOptions,
) {
  const payload = JSON.stringify({
    id: "evt_cancellation",
    created_at: 1896000000,
    eventType,
    object: { ...mockSubscription, status, current_period_end_date: periodEnd },
  });
  const signature = await generateSignature(payload, options.webhookSecret!);
  const ctx = createMockContext({
    adapter: store.adapter,
    requestText: payload,
    headers: { "creem-signature": signature },
  });
  await createWebhookEndpoint(options)(ctx);
  return ctx;
}

async function hasAccess(store: ReturnType<typeof createSubscriptionStore>) {
  const ctx = createMockContext({ adapter: store.adapter });
  await createHasAccessGrantedEndpoint(defaultOptions)(ctx);
  return ctx.json.mock.calls[0][0].hasAccessGranted;
}

afterEach(() => vi.useRealTimers());

describe("cancellation lifecycle through verified webhooks", () => {
  it("persists scheduled cancellation before its callback and retains access without provisioning callbacks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(periodEnd.getTime() - 1));
    const store = createSubscriptionStore();
    const onGrantAccess = vi.fn();
    const onRevokeAccess = vi.fn();
    const onSubscriptionScheduledCancel = vi.fn(async (data, ctx) => {
      expect(store.record).toMatchObject({
        status: "scheduled_cancel",
        cancelAtPeriodEnd: true,
        periodEnd,
      });
      expect(data).toMatchObject({
        webhookEventType: "subscription.scheduled_cancel",
        webhookId: "evt_cancellation",
        webhookCreatedAt: 1896000000,
        id: mockSubscription.id,
        current_period_end_date: periodEnd.toISOString(),
      });
      expect(ctx.context.adapter).toBe(store.adapter);
    });
    const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel", {
      ...defaultOptions,
      onGrantAccess,
      onRevokeAccess,
      onSubscriptionScheduledCancel,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(onSubscriptionScheduledCancel).toHaveBeenCalledTimes(1);
    expect(onGrantAccess).not.toHaveBeenCalled();
    expect(onRevokeAccess).not.toHaveBeenCalled();
    expect(await hasAccess(store)).toBe(true);
  });

  it.each([0, 1])(
    "denies scheduled cancellation at/after period end (%i ms) without waiting for another webhook",
    async (offset) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(periodEnd.getTime() + offset));
      const store = createSubscriptionStore();
      const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel");
      expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
      expect(await hasAccess(store)).toBe(false);
    },
  );

  it.each([undefined, new Date("invalid")])(
    "denies scheduled cancellation without a usable period end (%s)",
    async (missingEnd) => {
      const store = createSubscriptionStore();
      await store.adapter.update({ update: { status: "scheduled_cancel", periodEnd: missingEnd } });
      expect(await hasAccess(store)).toBe(false);
    },
  );

  it("revokes canceled subscriptions with a future period end and invokes the specific callback afterward", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(periodEnd.getTime() - 86400000));
    const store = createSubscriptionStore();
    await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel");
    const calls: string[] = [];
    const onRevokeAccess = vi.fn(async (data, ctx) => {
      expect(data).toMatchObject({ reason: "subscription_canceled", id: mockSubscription.id });
      expect(ctx.context.adapter).toBe(store.adapter);
      expect(store.record).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
      calls.push("revoke");
    });
    const onSubscriptionCanceled = vi.fn(async () => {
      calls.push("canceled");
    });
    const ctx = await deliver(store, "subscription.canceled", "canceled", {
      ...defaultOptions,
      onRevokeAccess,
      onSubscriptionCanceled,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(calls).toEqual(["revoke", "canceled"]);
    expect(await hasAccess(store)).toBe(false);
  });

  it.each([
    ["subscription.active", "active"],
    ["subscription.update", "active"],
    ["subscription.canceled", "canceled"],
    ["subscription.expired", "canceled"],
  ] as const)("clears the scheduled flag on %s with %s status", async (eventType, status) => {
    const store = createSubscriptionStore();
    await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel");
    await deliver(store, eventType, status);
    expect(store.record.cancelAtPeriodEnd).toBe(false);
    expect(store.record.status).toBe(eventType === "subscription.expired" ? "expired" : status);
  });

  it.each(["canceled", "expired"] as const)(
    "ignores a scheduled-cancellation retry after %s without restoring access",
    async (terminalStatus) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(periodEnd.getTime() - 1));
      const store = createSubscriptionStore();
      const onSubscriptionScheduledCancel = vi.fn().mockRejectedValueOnce(new Error("Retry"));
      const options = { ...defaultOptions, onSubscriptionScheduledCancel };
      const failed = await deliver(
        store,
        "subscription.scheduled_cancel",
        "scheduled_cancel",
        options,
      );
      expect(failed.json).toHaveBeenCalledWith(
        { error: "Failed to process webhook" },
        { status: 500 },
      );

      await deliver(store, `subscription.${terminalStatus}`, "canceled");
      const retried = await deliver(
        store,
        "subscription.scheduled_cancel",
        "scheduled_cancel",
        options,
      );
      expect(retried.json).toHaveBeenCalledWith({ message: "Webhook received" });
      expect(onSubscriptionScheduledCancel).toHaveBeenCalledTimes(1);
      expect(store.record).toMatchObject({ status: terminalStatus, cancelAtPeriodEnd: false });
      expect(await hasAccess(store)).toBe(false);

      await deliver(store, "subscription.update", "scheduled_cancel");
      expect(store.record.status).toBe(terminalStatus);
      expect(await hasAccess(store)).toBe(false);
    },
  );

  it("keeps terminal state when cancellation finishes between the scheduled-event lookup and write", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(periodEnd.getTime() - 1));
    const store = createSubscriptionStore();
    const update = store.adapter.update.getMockImplementation()!;
    store.adapter.update.mockImplementationOnce(async (args) => {
      await update({ update: { status: "canceled", cancelAtPeriodEnd: false } });
      return update(args);
    });
    const onSubscriptionScheduledCancel = vi.fn();
    const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel", {
      ...defaultOptions,
      onSubscriptionScheduledCancel,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(store.record).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
    expect(onSubscriptionScheduledCancel).not.toHaveBeenCalled();
    expect(await hasAccess(store)).toBe(false);
  });

  it.each(["past_due", "unpaid"] as const)(
    "preserves the existing %s grace period",
    async (status) => {
      vi.useFakeTimers();
      const store = createSubscriptionStore();
      await deliver(store, `subscription.${status}`, status);
      vi.setSystemTime(new Date(periodEnd.getTime() - 1));
      expect(await hasAccess(store)).toBe(true);
      vi.setSystemTime(periodEnd);
      expect(await hasAccess(store)).toBe(false);
      vi.setSystemTime(new Date(periodEnd.getTime() + 1));
      expect(await hasAccess(store)).toBe(false);
    },
  );

  it("suppresses the scheduled callback when an adapter throws after a concurrent terminal write", async () => {
    const store = createSubscriptionStore();
    const update = store.adapter.update.getMockImplementation()!;
    store.adapter.update.mockImplementationOnce(async () => {
      await update({ update: { status: "canceled", cancelAtPeriodEnd: false } });
      throw Object.assign(new Error("Record to update not found"), { code: "P2025" });
    });
    const onSubscriptionScheduledCancel = vi.fn();
    const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel", {
      ...defaultOptions,
      onSubscriptionScheduledCancel,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(store.record.status).toBe("canceled");
    expect(onSubscriptionScheduledCancel).not.toHaveBeenCalled();
  });

  it("retries scheduled persistence failures before running the callback", async () => {
    const store = createSubscriptionStore();
    store.adapter.update.mockRejectedValueOnce(new Error("Database unavailable"));
    const onSubscriptionScheduledCancel = vi.fn();
    const options = { ...defaultOptions, onSubscriptionScheduledCancel };
    const failed = await deliver(
      store,
      "subscription.scheduled_cancel",
      "scheduled_cancel",
      options,
    );
    expect(failed.json).toHaveBeenCalledWith(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
    expect(onSubscriptionScheduledCancel).not.toHaveBeenCalled();
    const retried = await deliver(
      store,
      "subscription.scheduled_cancel",
      "scheduled_cancel",
      options,
    );
    expect(retried.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(store.record.status).toBe("scheduled_cancel");
    expect(onSubscriptionScheduledCancel).toHaveBeenCalledTimes(1);
  });

  it("delivers a new subscription's scheduled callback without overwriting an older canceled fallback row", async () => {
    const store = createSubscriptionStore();
    await store.adapter.update({
      update: { creemSubscriptionId: "sub_older", status: "canceled" },
    });
    store.adapter.update.mockClear();
    store.adapter.findOne.mockResolvedValueOnce(null);
    const onSubscriptionScheduledCancel = vi.fn();
    const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel", {
      ...defaultOptions,
      onSubscriptionScheduledCancel,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(store.adapter.update).not.toHaveBeenCalled();
    expect(store.record).toMatchObject({ creemSubscriptionId: "sub_older", status: "canceled" });
    expect(onSubscriptionScheduledCancel).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: mockSubscription.id }),
      ctx,
    );
  });

  it("keeps the scheduled flag when a subscription.update still carries scheduled_cancel", async () => {
    const store = createSubscriptionStore();
    await deliver(store, "subscription.update", "scheduled_cancel");
    expect(store.record).toMatchObject({ status: "scheduled_cancel", cancelAtPeriodEnd: true });
  });

  it.each(["subscription.scheduled_cancel", "subscription.canceled"] as const)(
    "accepts %s without optional callbacks",
    async (eventType) => {
      const store = createSubscriptionStore();
      const ctx = await deliver(
        store,
        eventType,
        eventType === "subscription.canceled" ? "canceled" : "scheduled_cancel",
      );
      expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    },
  );

  it("runs scheduled cancellation callbacks with persistence disabled", async () => {
    const store = createSubscriptionStore();
    const onSubscriptionScheduledCancel = vi.fn();
    const ctx = await deliver(store, "subscription.scheduled_cancel", "scheduled_cancel", {
      ...defaultOptions,
      persistSubscriptions: false,
      onSubscriptionScheduledCancel,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(onSubscriptionScheduledCancel).toHaveBeenCalledTimes(1);
    expect(store.adapter.findOne).not.toHaveBeenCalled();
    expect(store.adapter.update).not.toHaveBeenCalled();
  });

  it("revokes canceled subscriptions with persistence disabled", async () => {
    const store = createSubscriptionStore();
    const onRevokeAccess = vi.fn();
    const onSubscriptionCanceled = vi.fn();
    const ctx = await deliver(store, "subscription.canceled", "canceled", {
      ...defaultOptions,
      persistSubscriptions: false,
      onRevokeAccess,
      onSubscriptionCanceled,
    });
    expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    expect(onRevokeAccess).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reason: "subscription_canceled", id: mockSubscription.id }),
      ctx,
    );
    expect(onSubscriptionCanceled).toHaveBeenCalledTimes(1);
    expect(store.adapter.findOne).not.toHaveBeenCalled();
    expect(store.adapter.findMany).not.toHaveBeenCalled();
    expect(store.adapter.update).not.toHaveBeenCalled();
  });

  it.each([
    ["subscription.scheduled_cancel", "scheduled_cancel", "onSubscriptionScheduledCancel"],
    ["subscription.canceled", "canceled", "onRevokeAccess"],
    ["subscription.canceled", "canceled", "onSubscriptionCanceled"],
  ] as const)(
    "awaits %s %s callback %s before acknowledging",
    async (eventType, status, callbackName) => {
      const store = createSubscriptionStore();
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const callback = vi.fn(async () => {
        started();
        await pending;
      });
      let finished = false;
      const delivery = deliver(store, eventType, status, {
        ...defaultOptions,
        [callbackName]: callback,
      }).then((ctx) => {
        finished = true;
        return ctx;
      });
      await entered;
      expect(finished).toBe(false);
      release();
      const ctx = await delivery;
      expect(ctx.json).toHaveBeenCalledWith({ message: "Webhook received" });
    },
  );

  it.each([
    ["subscription.scheduled_cancel", "scheduled_cancel", "onSubscriptionScheduledCancel"],
    ["subscription.canceled", "canceled", "onRevokeAccess"],
  ] as const)(
    "returns 500 on %s callback failure and accepts a retry",
    async (eventType, status, callbackName) => {
      const store = createSubscriptionStore();
      const callback = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary provisioning failure"))
        .mockResolvedValue(undefined);
      const options = { ...defaultOptions, [callbackName]: callback };
      const failed = await deliver(store, eventType, status, options);
      expect(failed.json).toHaveBeenCalledWith(
        { error: "Failed to process webhook" },
        { status: 500 },
      );
      const retried = await deliver(store, eventType, status, options);
      expect(retried.json).toHaveBeenCalledWith({ message: "Webhook received" });
      expect(callback).toHaveBeenCalledTimes(2);
      expect(store.record.cancelAtPeriodEnd).toBe(status === "scheduled_cancel");
    },
  );
});
