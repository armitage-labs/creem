// This package compiles to CommonJS while @ai-sdk/provider is ESM-only, so
// the type-only import needs an explicit resolution mode (TS1541). Nothing
// is imported at runtime.
import type {
  LanguageModelV3,
  LanguageModelV3Usage,
  LanguageModelV4,
  LanguageModelV4Usage,
} from "@ai-sdk/provider" with { "resolution-mode": "import" };
import { IngestionStrategy, type EmitUsage } from "../strategy.js";
import type { EventProperties, IngestionCustomer } from "../types.js";

/**
 * The language-model interface versions this strategy meters. V3 (AI SDK 6)
 * and V4 (AI SDK 7) share the same nested usage shape, so both are wrapped
 * by the same code path. V2 (AI SDK 5) is not supported.
 */
export type SupportedLanguageModel = LanguageModelV3 | LanguageModelV4;

type TokenUsage = LanguageModelV3Usage | LanguageModelV4Usage;

// Providers occasionally report NaN or missing token counts; a NaN would
// serialize to null and corrupt the meter's aggregation, so anything
// non-finite counts as 0.
const toCount = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const usageToProperties = (model: SupportedLanguageModel, usage: TokenUsage): EventProperties => {
  const inputTokens = toCount(usage.inputTokens.total);
  const outputTokens = toCount(usage.outputTokens.total);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_input_tokens: toCount(usage.inputTokens.cacheRead),
    total_tokens: inputTokens + outputTokens,
    model: model.modelId,
    vendor: model.provider,
    _llm: true,
  };
};

/**
 * Watches a stream for its `finish` part (which carries the usage) without
 * disturbing what flows through — every part is re-emitted untouched.
 */
const watchForFinish = <TPart>(
  stream: ReadableStream<TPart>,
  onFinish: (usage: TokenUsage) => void,
): ReadableStream<TPart> =>
  stream.pipeThrough(
    new TransformStream<TPart, TPart>({
      transform(part, controller) {
        const candidate = part as { type?: string; usage?: TokenUsage };
        if (candidate.type === "finish" && candidate.usage) {
          onFinish(candidate.usage);
        }
        controller.enqueue(part);
      },
    }),
  );

/**
 * Meters a Vercel AI SDK language model: wrap the model once, use it with
 * `generateText` / `streamText` (or directly) as normal, and every call
 * emits a usage event with the token counts.
 *
 * ```ts
 * import { AiSdkStrategy } from "@creem_io/ingestion/ai-sdk";
 *
 * const metered = ingestion
 *   .strategy(new AiSdkStrategy(openai("gpt-4o")))
 *   .ingest("llm-usage");
 *
 * const model = metered.client({ externalCustomerId: userId });
 * const result = await generateText({ model, prompt });
 * ```
 *
 * Both `doGenerate` and `doStream` are metered; for streams the usage is
 * read from the `finish` part as it passes through, so consuming the stream
 * exactly once is enough — no double-read, no buffering.
 */
export class AiSdkStrategy<
  TModel extends SupportedLanguageModel,
> extends IngestionStrategy<TModel> {
  readonly strategyKind = "ai-sdk";

  constructor(private readonly model: TModel) {
    super();
  }

  createClient(_customer: IngestionCustomer, emit: EmitUsage): TModel {
    const { model } = this;
    const report = (usage: TokenUsage): void =>
      emit({ properties: usageToProperties(model, usage) });

    return new Proxy(model, {
      get(target, property, receiver) {
        // The interception functions take `never` so the call through the
        // V3|V4 union typechecks; externally the Proxy is typed as TModel,
        // so callers still see the model's real signatures.
        if (property === "doGenerate") {
          return async (options: never) => {
            const result = await target.doGenerate(options);
            report(result.usage);
            return result;
          };
        }
        if (property === "doStream") {
          return async (options: never) => {
            const result = await target.doStream(options);
            // The V3/V4 union does not distribute through the generic;
            // the watcher only duck-types the `finish` part, so widening
            // the part type is safe.
            const stream = watchForFinish(result.stream as ReadableStream<unknown>, report);
            return { ...result, stream };
          };
        }
        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
}
