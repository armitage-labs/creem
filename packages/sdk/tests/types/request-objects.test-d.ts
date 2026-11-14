import { describe, expectTypeOf, it } from "vitest";
import type { ClientSDK, RequestOptions } from "../../src/lib/sdks.js";
import type * as operations from "../../src/models/operations/index.js";
import type { Creem } from "../../src/sdk/sdk.js";

/**
 * ENG-2487, checked by the type checker (`vitest --typecheck`): every SDK
 * method takes one request object, then the optional `RequestOptions`. If a
 * method takes a positional argument again (for example after `maxMethodParams`
 * goes back up in `.speakeasy/gen.yaml`), `PositionalMethods<Creem>` names it.
 */

type Resources<Client> = {
  [K in keyof Client]: Client[K] extends ClientSDK ? K : never;
}[keyof Client];

type Methods<Resource> = {
  [K in Exclude<keyof Resource, keyof ClientSDK>]: Resource[K] extends (...args: never[]) => unknown
    ? K
    : never;
}[Exclude<keyof Resource, keyof ClientSDK>];

type TakesOneRequestObject<Method> = Method extends (...args: infer Args) => unknown
  ? Args extends [infer Request, (RequestOptions | undefined)?]
    ? [Request] extends [object]
      ? true
      : false
    : false
  : false;

type PositionalMethods<Client> = {
  [R in Resources<Client> & string]: {
    [M in Methods<Client[R]> & string]: TakesOneRequestObject<Client[R][M]> extends true
      ? never
      : `${R}.${M}`;
  }[Methods<Client[R]> & string];
}[Resources<Client> & string];

describe("request objects (ENG-2487)", () => {
  it("every method of every resource takes one request object, then the options", () => {
    // The walk reaches the resources and their methods (it isn't vacuously empty).
    expectTypeOf<"products" | "subscriptions" | "webhooks">().toExtend<Resources<Creem>>();
    expectTypeOf<"create" | "update" | "search">().toExtend<Methods<Creem["products"]>>();

    expectTypeOf<PositionalMethods<Creem>>().toEqualTypeOf<never>();
  });

  it("the check names a method that still takes positional arguments", () => {
    // Negative control: the 1.x shape of products.update and products.get.
    class LegacyProducts extends (Object as unknown as typeof ClientSDK) {
      async update(_id: string, _body: { name?: string }, _options?: RequestOptions) {}
      async get(_id: string, _options?: RequestOptions) {}
      async search(_request: { pageNumber?: number }, _options?: RequestOptions) {}
    }
    type LegacyClient = { readonly products: LegacyProducts };

    expectTypeOf<PositionalMethods<LegacyClient>>().toEqualTypeOf<
      "products.update" | "products.get"
    >();
  });

  it("an optional parameter the API adds is an optional property, so existing calls still compile", () => {
    // What ENG-2229 does to products.update: `?dry_run=true` becomes `dryRun?`.
    type UpdateProductWithDryRun = operations.UpdateProductRequest & {
      dryRun?: boolean | undefined;
    };
    const callWrittenToday = {
      id: "prod_123",
      updateProductRequestEntity: { name: "Pro" },
    } satisfies operations.UpdateProductRequest;

    expectTypeOf(callWrittenToday).toExtend<UpdateProductWithDryRun>();
    expectTypeOf<Creem["products"]["update"]>()
      .parameter(1)
      .toEqualTypeOf<RequestOptions | undefined>();
  });
});
