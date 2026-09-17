import { describe, expect, it, vi } from "vitest";
import { BufferedDelivery, type WireEvent } from "../src/delivery.js";
import type { IngestResult, IngestionError } from "../src/types.js";

const accepted = (events: WireEvent[]): IngestResult => ({
  accepted: events.length,
  eventIds: events.map((event) => event.eventId ?? "generated"),
});

const harness = (
  send: (events: WireEvent[]) => Promise<IngestResult>,
  overrides: Partial<{
    maxBatchSize: number;
    flushIntervalMs: number;
    maxQueueSize: number;
    maxRetries: number;
    onError: (error: IngestionError) => void;
    onWarnings: (warnings: NonNullable<IngestResult["warnings"]>) => void;
  }> = {},
) => {
  const errors: IngestionError[] = [];
  const warnings: NonNullable<IngestResult["warnings"]>[] = [];
  const delivery = new BufferedDelivery(send, {
    maxBatchSize: overrides.maxBatchSize ?? 100,
    flushIntervalMs: overrides.flushIntervalMs ?? 50,
    maxQueueSize: overrides.maxQueueSize ?? 1_000,
    maxRetries: overrides.maxRetries ?? 3,
    onError: overrides.onError ?? ((error) => errors.push(error)),
    onWarnings: overrides.onWarnings ?? ((batch) => warnings.push(batch)),
    sleep: () => Promise.resolve(),
  });
  return { delivery, errors, warnings };
};

describe("BufferedDelivery", () => {
  it("assigns an eventId at enqueue time and preserves a caller-supplied one", async () => {
    const sent: WireEvent[][] = [];
    const { delivery } = harness(async (events) => {
      sent.push(events);
      return accepted(events);
    });

    delivery.enqueue({ name: "tokens_used", customerId: "cust_1" });
    delivery.enqueue({
      name: "tokens_used",
      customerId: "cust_1",
      eventId: "mine",
    });
    await delivery.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0][0].eventId).toMatch(/[0-9a-f-]{36}/);
    expect(sent[0][1].eventId).toBe("mine");
  });

  it("flushes automatically when the batch size is reached", async () => {
    const sent: WireEvent[][] = [];
    const { delivery } = harness(
      async (events) => {
        sent.push(events);
        return accepted(events);
      },
      { maxBatchSize: 2 },
    );

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await delivery.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(2);
  });

  it("flushes on the interval without an explicit flush call", async () => {
    vi.useFakeTimers();
    try {
      const sent: WireEvent[][] = [];
      const { delivery } = harness(
        async (events) => {
          sent.push(events);
          return accepted(events);
        },
        { flushIntervalMs: 1_000 },
      );

      delivery.enqueue({ name: "e", customerId: "cust_1" });
      expect(sent).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(sent).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries with the SAME eventIds so server dedup collapses replays", async () => {
    const sent: WireEvent[][] = [];
    let failures = 2;
    const { delivery, errors } = harness(async (events) => {
      sent.push(events);
      if (failures > 0) {
        failures -= 1;
        throw new Error("network down");
      }
      return accepted(events);
    });

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await delivery.flush();

    expect(sent).toHaveLength(3);
    const ids = sent.map((batch) => batch[0].eventId);
    expect(new Set(ids).size).toBe(1);
    expect(errors).toHaveLength(0);
  });

  it("drops the batch after maxRetries retries and reports delivery_failed", async () => {
    let calls = 0;
    const { delivery, errors } = harness(
      async () => {
        calls += 1;
        throw new Error("still down");
      },
      { maxRetries: 2 },
    );

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await delivery.flush();

    // maxRetries counts retries, not attempts: 1 initial + 2 retries.
    expect(calls).toBe(3);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Batch dropped after 3 delivery attempts.");
    expect(errors[0].code).toBe("delivery_failed");
    expect(errors[0].events).toHaveLength(1);
  });

  it("does not retry a non-retryable API error", async () => {
    let calls = 0;
    const { delivery, errors } = harness(async () => {
      calls += 1;
      // Shaped like the SDK's `CreemError`: HTTP errors expose `statusCode`.
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    });

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await delivery.flush();

    expect(calls).toBe(1);
    expect(errors[0].code).toBe("delivery_failed");
  });

  it("evicts the event a 422 names and delivers the rest of the batch", async () => {
    const sent: WireEvent[][] = [];
    const { delivery, errors } = harness(async (events) => {
      sent.push(events);
      if (events.some((event) => event.customerId === "cust_bad")) {
        const index = events.findIndex((event) => event.customerId === "cust_bad");
        // Shaped like `UsageMeteringErrorApiResponseDto`: the 422 envelope
        // carries `error.param` naming the offending event.
        throw Object.assign(new Error("unknown customer"), {
          statusCode: 422,
          error: { param: `events[${index}].customer_id` },
        });
      }
      return accepted(events);
    });

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    delivery.enqueue({ name: "e", customerId: "cust_bad" });
    delivery.enqueue({ name: "e", customerId: "cust_2" });
    await delivery.flush();

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("event_rejected");
    expect(errors[0].events[0].customerId).toBe("cust_bad");
    const delivered = sent[sent.length - 1];
    expect(delivered.map((event) => event.customerId)).toEqual(["cust_1", "cust_2"]);
  });

  it("bounds the queue and reports the dropped event", async () => {
    const { delivery, errors } = harness(async (events) => accepted(events), {
      maxQueueSize: 2,
      flushIntervalMs: 60_000,
    });

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    delivery.enqueue({ name: "e", customerId: "cust_2" });
    delivery.enqueue({ name: "e", customerId: "cust_3" });

    expect(delivery.pending).toBe(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("queue_overflow");
    expect(errors[0].events[0].customerId).toBe("cust_3");
    await delivery.close();
  });

  it("surfaces 202 warnings", async () => {
    const { delivery, warnings } = harness(async (events) => ({
      ...accepted(events),
      warnings: [
        {
          index: 0,
          code: "no_matching_meter" as const,
          message: "no meter consumes this event name",
        },
      ],
    }));

    delivery.enqueue({ name: "unmetered", customerId: "cust_1" });
    await delivery.flush();

    expect(warnings).toHaveLength(1);
    expect(warnings[0][0].code).toBe("no_matching_meter");
  });

  it("never throws into the caller even when everything fails", async () => {
    const { delivery } = harness(
      async () => {
        throw new Error("catastrophe");
      },
      { onError: () => undefined },
    );

    expect(() => delivery.enqueue({ name: "e", customerId: "cust_1" })).not.toThrow();
    await expect(delivery.flush()).resolves.toBeUndefined();
  });

  it("close() flushes and then refuses further events", async () => {
    const sent: WireEvent[][] = [];
    const { delivery, errors } = harness(async (events) => {
      sent.push(events);
      return accepted(events);
    });

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await delivery.close();
    delivery.enqueue({ name: "e", customerId: "cust_2" });

    expect(sent).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("delivery_failed");
  });

  it("a throwing onError does not poison subsequent flushes", async () => {
    const sent: WireEvent[][] = [];
    let calls = 0;
    const { delivery } = harness(
      async (events) => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
        sent.push(events);
        return accepted(events);
      },
      {
        maxRetries: 1,
        onError: () => {
          throw new Error("logger exploded");
        },
      },
    );

    delivery.enqueue({ name: "e", customerId: "cust_1" });
    await expect(delivery.flush()).resolves.toBeUndefined();

    delivery.enqueue({ name: "e", customerId: "cust_2" });
    await expect(delivery.flush()).resolves.toBeUndefined();

    expect(sent).toHaveLength(1);
    expect(sent[0][0].customerId).toBe("cust_2");
    expect(delivery.pending).toBe(0);
  });

  it("a throwing onWarnings does not reject the flush", async () => {
    const { delivery } = harness(
      async (events) => ({
        ...accepted(events),
        warnings: [{ index: 0, code: "no_matching_meter" as const, message: "nothing listening" }],
      }),
      {
        onWarnings: () => {
          throw new Error("logger exploded");
        },
      },
    );

    delivery.enqueue({ name: "unmetered", customerId: "cust_1" });
    await expect(delivery.flush()).resolves.toBeUndefined();
    expect(delivery.pending).toBe(0);
  });

  it("a throwing onError on enqueue overflow does not throw into the caller", () => {
    const { delivery } = harness(async (events) => accepted(events), {
      maxQueueSize: 0,
      onError: () => {
        throw new Error("logger exploded");
      },
    });

    expect(() => delivery.enqueue({ name: "e", customerId: "cust_1" })).not.toThrow();
  });

  it("splits an oversized backlog into server-sized batches", async () => {
    const sent: WireEvent[][] = [];
    const { delivery } = harness(
      async (events) => {
        sent.push(events);
        return accepted(events);
      },
      { maxBatchSize: 2, flushIntervalMs: 60_000, maxQueueSize: 10 },
    );

    for (let index = 0; index < 5; index += 1) {
      delivery.enqueue({ name: "e", customerId: `cust_${index}` });
    }
    await delivery.flush();

    expect(sent.map((batch) => batch.length)).toEqual([2, 2, 1]);
  });
});
