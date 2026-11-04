import { describe, expect, expectTypeOf, it } from "vitest";
import { Creem } from "../src/sdk/sdk.js";
import { HTTPClient } from "../src/lib/http.js";
import type * as operations from "../src/models/operations/index.js";

/**
 * ENG-2487: every method takes one request object, then the options. A new
 * optional API parameter is therefore a new optional property of the request:
 * it never takes the place of `options` in an existing call, which in 1.x
 * shifted `options` into the new parameter (TypeScript stopped compiling it,
 * JavaScript sent `?dry_run=[object Object]`).
 */
function clientRecording(requests: Request[]): Creem {
  return new Creem({
    apiKey: "creem_test_fixture",
    httpClient: new HTTPClient({
      fetcher: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ items: [], pagination: {} });
      },
    }),
  });
}

describe("request objects (ENG-2487)", () => {
  it("takes the request, then the options, on every changed method", () => {
    const creem = clientRecording([]);

    expectTypeOf(creem.products.update).parameters.toEqualTypeOf<
      [operations.UpdateProductRequest, (import("../src/lib/sdks.js").RequestOptions | undefined)?]
    >();
    expectTypeOf(creem.products.search).parameter(0).toEqualTypeOf<operations.SearchProductsRequest>();
    expectTypeOf(creem.transactions.search).parameter(0).toEqualTypeOf<operations.SearchTransactionsRequest>();
  });

  it("sends the request object's query parameters and keeps the options as options", async () => {
    const requests: Request[] = [];
    const creem = clientRecording(requests);

    await creem.products
      .search({ pageNumber: 2, pageSize: 5 }, { headers: { "x-fixture": "kept" } })
      .catch(() => undefined);

    const url = new URL(requests[0].url);
    expect(url.pathname).toBe("/v1/products/search");
    expect(url.searchParams.get("page_number")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("5");
    // The options object never leaks into the query, whatever parameters the operation gains.
    expect([...url.searchParams.keys()].sort()).toEqual(["page_number", "page_size"]);
    expect(requests[0].headers.get("x-fixture")).toBe("kept");
  });

  it("sends the path parameter and the body from the same request object", async () => {
    const requests: Request[] = [];
    const creem = clientRecording(requests);

    await creem.products
      .update({ id: "prod_fixture", updateProductRequestEntity: { name: "Pro" } })
      .catch(() => undefined);

    expect(requests[0].method).toBe("PATCH");
    expect(new URL(requests[0].url).pathname).toBe("/v1/products/prod_fixture");
    expect(await requests[0].json()).toEqual({ name: "Pro" });
  });
});
