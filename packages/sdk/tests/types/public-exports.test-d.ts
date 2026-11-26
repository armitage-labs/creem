import { expectTypeOf, test } from "vitest";
import type * as components from "../../src/models/components/index.js";

// ENG-2972: a field keeps its type across a regeneration.
test("a product write warning's impact keeps its type", () => {
  expectTypeOf<components.ProductWriteWarningEntity["impact"]>().toEqualTypeOf<
    components.ProductWriteImpactEntity | undefined
  >();
});
