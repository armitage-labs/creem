import { describe, expectTypeOf, it } from "vitest";
import type { Creem } from "creem";
import { Ingestion, IngestionPipeline } from "../../src/ingestion.js";
import type { IngestionClient, IngestionConfig } from "../../src/types.js";

/**
 * `IngestionConfig.client` must stay what it was for code that reads it (a
 * `Creem`), and accept a client from another `creem` major for code that passes
 * one. A `Creem` from another major is a different class (ECMAScript private
 * fields make classes nominal), so it fits only through the structural
 * `IngestionClient`, which `Ingestion()` infers.
 */
class CreemFromAnotherMajor {
  readonly #httpClient = "not the same class as this version's Creem";
  readonly events = {
    ingestEvents: (async () => ({ accepted: 0 })) as unknown as Creem["events"]["ingestEvents"],
  };
  describe(): string {
    return this.#httpClient;
  }
}

describe("IngestionConfig.client", () => {
  it("reads as Creem, as in 0.1.x", () => {
    expectTypeOf<IngestionConfig["client"]>().toEqualTypeOf<Creem | undefined>();
    const readsTheWholeClient = (config: IngestionConfig) => config.client?.customers;
    expectTypeOf(readsTheWholeClient).returns.not.toBeAny();
  });

  it("accepts this version's Creem and a client from another major", () => {
    expectTypeOf(Ingestion).toBeCallableWith({ client: {} as Creem });
    expectTypeOf(Ingestion).toBeCallableWith({ client: new CreemFromAnotherMajor() });
    expectTypeOf(Ingestion).toBeCallableWith({ client: {} as IngestionClient });
    expectTypeOf(Ingestion).toBeCallableWith({ apiKey: "creem_test_fixture" });
    expectTypeOf(IngestionPipeline).constructorParameters.toEqualTypeOf<
      [IngestionConfig<IngestionClient>]
    >();
  });

  it("types a config for another major by its client", () => {
    expectTypeOf<IngestionConfig<CreemFromAnotherMajor>["client"]>().toEqualTypeOf<
      CreemFromAnotherMajor | undefined
    >();
  });

  it("refuses a client without events.ingestEvents", () => {
    // @ts-expect-error the pipeline calls events.ingestEvents
    Ingestion({ client: { events: {} } });
  });
});
