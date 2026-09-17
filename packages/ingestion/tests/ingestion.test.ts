import type { Creem } from "creem";
import { describe, expect, it, vi } from "vitest";
import { Ingestion } from "../src/ingestion.js";
import { IngestionStrategy, type EmitUsage } from "../src/strategy.js";
import type {
  IngestResult,
  IngestionCustomer,
  IngestionError,
  IngestWarnings,
} from "../src/types.js";

interface IngestCall {
  events: Array<{
    name: string;
    customerId?: string;
    externalCustomerId?: string;
    eventId?: string;
    timestamp?: string;
    properties?: Record<string, unknown>;
  }>;
}

const fakeCreem = (result?: Partial<IngestResult>) => {
  const calls: IngestCall[] = [];
  const ingestEvents = vi.fn(async (request: IngestCall) => {
    calls.push(request);
    return {
      accepted: request.events.length,
      eventIds: request.events.map((event) => event.eventId ?? "gen"),
      ...result,
    };
  });
  return {
    calls,
    ingestEvents,
    client: { events: { ingestEvents } } as unknown as Creem,
  };
};

/** A minimal strategy: a function client that reports a token count. */
class FakeMeterStrategy extends IngestionStrategy<(tokens: number) => void> {
  readonly strategyKind = "fake-meter";

  createClient(_customer: IngestionCustomer, emit: EmitUsage): (tokens: number) => void {
    return (tokens: number) => emit({ properties: { tokens: tokens } });
  }
}

describe("Ingestion", () => {
  it("ingest() sends the wire shape and returns the 202 envelope", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });

    const result = await pipeline.ingest([
      {
        name: "tokens_used",
        customerId: "cust_1",
        eventId: "evt-1",
        timestamp: new Date("2026-09-15T00:00:00.000Z"),
        properties: { tokens: 512 },
      },
    ]);

    expect(result.accepted).toBe(1);
    expect(calls[0].events[0]).toEqual({
      name: "tokens_used",
      customerId: "cust_1",
      externalCustomerId: undefined,
      eventId: "evt-1",
      timestamp: "2026-09-15T00:00:00.000Z",
      properties: { tokens: 512 },
    });
  });

  it("ingest() assigns an eventId when absent and preserves a supplied one", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });

    const result = await pipeline.ingest([
      { name: "tokens_used", customerId: "cust_1" },
      { name: "tokens_used", customerId: "cust_1", eventId: "mine" },
    ]);

    expect(calls[0].events[0].eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[0].events[1].eventId).toBe("mine");
    expect(result.eventIds).toEqual([calls[0].events[0].eventId, "mine"]);
  });

  it("ingest() surfaces warnings through onWarnings AND the return value", async () => {
    const warnings: IngestWarnings[] = [];
    const { client } = fakeCreem({
      warnings: [
        { index: 0, code: "no_matching_meter", message: "nothing listening" },
      ] as IngestResult["warnings"],
    });
    const pipeline = Ingestion({
      client,
      onWarnings: (batch) => warnings.push(batch),
    });

    const result = await pipeline.ingest([{ name: "unmetered", externalCustomerId: "user-42" }]);

    expect(result.warnings?.[0].code).toBe("no_matching_meter");
    expect(warnings).toHaveLength(1);
  });

  it("enqueue() + flush() delivers through the buffer", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });

    pipeline.enqueue({ name: "tokens_used", externalCustomerId: "user-42" });
    expect(pipeline.pending).toBe(1);
    await pipeline.flush();

    expect(pipeline.pending).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].events[0].externalCustomerId).toBe("user-42");
    expect(calls[0].events[0].eventId).toMatch(/[0-9a-f-]{36}/);
  });

  it("strategy().cost().ingest() emits buffered events with reserved keys", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });

    const metered = pipeline
      .strategy(new FakeMeterStrategy())
      .cost((emission) => Number(emission.properties.tokens) * 2)
      .ingest("openai-usage", (emission) => ({
        doubled: Number(emission.properties.tokens) * 2,
      }));

    const meter = metered.client({ customerId: "cust_1" });
    meter(21);
    await pipeline.flush();

    const event = calls[0].events[0];
    expect(event.name).toBe("openai-usage");
    expect(event.customerId).toBe("cust_1");
    expect(event.properties).toEqual({
      tokens: 21,
      doubled: 42,
      strategy: "fake-meter",
      _cost: 42,
    });
  });

  it("one strategy serves many customers concurrently without cross-talk", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });
    const metered = pipeline.strategy(new FakeMeterStrategy()).ingest("openai-usage");

    metered.client({ customerId: "cust_1" })(1);
    metered.client({ externalCustomerId: "user-42" })(2);
    await pipeline.flush();

    const events = calls[0].events;
    expect(events[0].customerId).toBe("cust_1");
    expect(events[0].properties?.tokens).toBe(1);
    expect(events[1].externalCustomerId).toBe("user-42");
    expect(events[1].properties?.tokens).toBe(2);
  });

  it("a throwing resolver is reported via onError instead of throwing into the metered call", async () => {
    const { client, calls } = fakeCreem();
    const errors: IngestionError[] = [];
    const pipeline = Ingestion({ client, onError: (error) => errors.push(error) });
    const metered = pipeline
      .strategy(new FakeMeterStrategy())
      .cost(() => {
        throw new Error("pricing table unavailable");
      })
      .ingest("openai-usage");
    const meter = metered.client({ customerId: "cust_1" });

    expect(() => meter(7)).not.toThrow();
    await pipeline.flush();

    expect(calls).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("resolver_failed");
    expect(errors[0].events[0]).toMatchObject({
      name: "openai-usage",
      customerId: "cust_1",
      properties: { tokens: 7, strategy: "fake-meter" },
    });
    expect((errors[0].cause as Error).message).toBe("pricing table unavailable");
  });

  it("a strategy emission can never throw into the caller's path", async () => {
    const { client } = fakeCreem();
    const pipeline = Ingestion({ client, maxQueueSize: 0 });
    const metered = pipeline.strategy(new FakeMeterStrategy()).ingest("openai-usage");
    const meter = metered.client({ customerId: "cust_1" });

    expect(() => meter(1)).not.toThrow();
  });
});
