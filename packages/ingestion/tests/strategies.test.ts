import type { Creem } from "creem";
import { describe, expect, it, vi } from "vitest";
import { Ingestion } from "../src/ingestion.js";
import { AiSdkStrategy } from "../src/strategies/ai-sdk.js";
import { DeltaTimeStrategy } from "../src/strategies/delta-time.js";

interface IngestCall {
  events: Array<{
    name: string;
    customerId?: string;
    externalCustomerId?: string;
    properties?: Record<string, unknown>;
  }>;
}

const fakeCreem = () => {
  const calls: IngestCall[] = [];
  const ingestEvents = vi.fn(async (request: IngestCall) => {
    calls.push(request);
    return {
      accepted: request.events.length,
      eventIds: request.events.map(() => "gen"),
    };
  });
  return { calls, client: { events: { ingestEvents } } as unknown as Creem };
};

const usage = {
  inputTokens: { total: 100, noCache: 80, cacheRead: 20, cacheWrite: 0 },
  outputTokens: { total: 40, text: 30, reasoning: 10 },
};

/**
 * A minimal fake implementing the slice of the V4 language-model spec the
 * strategy touches, plus one extra method/property to prove delegation.
 */
const fakeModel = () => {
  const doGenerate = vi.fn(async () => ({
    content: [{ type: "text", text: "hello" }],
    finishReason: "stop",
    usage: usage,
  }));
  const doStream = vi.fn(async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-delta", delta: "hel" });
        controller.enqueue({ type: "text-delta", delta: "lo" });
        controller.enqueue({
          type: "finish",
          usage: usage,
          finishReason: "stop",
        });
        controller.close();
      },
    }),
  }));
  return {
    specificationVersion: "v4" as const,
    provider: "openai",
    modelId: "gpt-4o",
    supportedUrls: {},
    doGenerate: doGenerate,
    doStream: doStream,
    describe: () => "the underlying model",
  };
};

// The fake covers the structural slice the strategy uses; the full V4
// interface is exercised against the real @ai-sdk/provider types in the
// strategy source itself.
type ModelLike = ReturnType<typeof fakeModel>;

describe("AiSdkStrategy", () => {
  const build = () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });
    const model = fakeModel();
    const metered = pipeline
      // The fake is structurally V4-shaped; the cast confines the fixture,
      // not the production types.
      .strategy(new AiSdkStrategy(model as never))
      .ingest("llm-usage");
    return { pipeline, model, metered, calls };
  };

  it("meters doGenerate with token counts, model, vendor, and _llm", async () => {
    const { pipeline, metered, calls } = build();
    const wrapped = metered.client({ customerId: "cust_1" }) as ModelLike;

    const result = await wrapped.doGenerate();
    expect(result.usage).toEqual(usage);
    await pipeline.flush();

    const event = calls[0].events[0];
    expect(event.name).toBe("llm-usage");
    expect(event.customerId).toBe("cust_1");
    expect(event.properties).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      cached_input_tokens: 20,
      total_tokens: 140,
      model: "gpt-4o",
      vendor: "openai",
      _llm: true,
      strategy: "ai-sdk",
    });
  });

  it("meters doStream from the finish part without disturbing the stream", async () => {
    const { pipeline, metered, calls } = build();
    const wrapped = metered.client({ externalCustomerId: "user-42" }) as ModelLike;

    const { stream } = await wrapped.doStream();
    const parts: Array<{ type: string }> = [];
    const reader = (stream as ReadableStream<{ type: string }>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    await pipeline.flush();

    // Every part passed through untouched, in order.
    expect(parts.map((part) => part.type)).toEqual([
      "stream-start",
      "text-delta",
      "text-delta",
      "finish",
    ]);
    const event = calls[0].events[0];
    expect(event.externalCustomerId).toBe("user-42");
    expect(event.properties?.input_tokens).toBe(100);
    expect(event.properties?.output_tokens).toBe(40);
  });

  it("coerces NaN and missing token counts to 0", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });
    const model = fakeModel();
    model.doGenerate = vi.fn(async () => ({
      content: [],
      finishReason: "stop",
      usage: {
        inputTokens: {
          total: Number.NaN,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: undefined, text: undefined, reasoning: undefined },
      },
    })) as ModelLike["doGenerate"];
    const metered = pipeline.strategy(new AiSdkStrategy(model as never)).ingest("llm-usage");
    const wrapped = metered.client({ customerId: "cust_1" }) as ModelLike;

    await wrapped.doGenerate();
    await pipeline.flush();

    const properties = calls[0].events[0].properties;
    expect(properties?.input_tokens).toBe(0);
    expect(properties?.output_tokens).toBe(0);
    expect(properties?.cached_input_tokens).toBe(0);
    expect(properties?.total_tokens).toBe(0);
  });

  it("delegates everything else to the underlying model", () => {
    const { metered } = build();
    const wrapped = metered.client({ customerId: "cust_1" }) as ModelLike;

    expect(wrapped.provider).toBe("openai");
    expect(wrapped.modelId).toBe("gpt-4o");
    expect(wrapped.describe()).toBe("the underlying model");
  });

  it("does not emit when the stream is never consumed to the finish part", async () => {
    const { pipeline, metered, calls } = build();
    const wrapped = metered.client({ customerId: "cust_1" }) as ModelLike;

    const { stream } = await wrapped.doStream();
    const reader = (stream as ReadableStream<{ type: string }>).getReader();
    await reader.read(); // stream-start only
    await reader.cancel();
    await pipeline.flush();

    expect(calls).toHaveLength(0);
  });
});

describe("DeltaTimeStrategy", () => {
  it("meters a successful execution's wall-clock duration", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });
    let tick = 1_000;
    const metered = pipeline
      .strategy(new DeltaTimeStrategy(() => (tick += 250)))
      .ingest("compute-time");
    const timed = metered.client({ customerId: "cust_1" });

    const output = await timed(() => Promise.resolve("rendered"));
    await pipeline.flush();

    expect(output).toBe("rendered");
    expect(calls[0].events[0].properties).toEqual({
      delta_time_ms: 250,
      strategy: "delta-time",
    });
  });

  it("bills nothing when the execution throws", async () => {
    const { client, calls } = fakeCreem();
    const pipeline = Ingestion({ client });
    const metered = pipeline.strategy(new DeltaTimeStrategy()).ingest("compute-time");
    const timed = metered.client({ customerId: "cust_1" });

    await expect(timed(() => Promise.reject(new Error("job failed")))).rejects.toThrow(
      "job failed",
    );
    await pipeline.flush();

    expect(calls).toHaveLength(0);
  });
});
