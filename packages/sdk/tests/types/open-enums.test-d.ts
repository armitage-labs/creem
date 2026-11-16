import { describe, expectTypeOf, it } from "vitest";
import type { ProductStatus } from "../../src/models/components/productstatus.js";
import type { Unrecognized } from "../../src/types/unrecognized.js";

/**
 * ENG-2487: response enums are open, so a `switch` over the known values is no
 * longer exhaustive. MIGRATION.md says which patterns stop compiling; these
 * pin that statement.
 */
describe("open response enums", () => {
  it("a never exhaustiveness check over the known values no longer compiles", () => {
    const check = (status: ProductStatus): string => {
      switch (status) {
        case "active":
          return "Active";
        case "archived":
          return "Archived";
        default: {
          // @ts-expect-error a status added later reaches the default branch
          const unhandled: never = status;
          return unhandled;
        }
      }
    };
    expectTypeOf(check).returns.toEqualTypeOf<string>();
  });

  it("a switch with a default branch compiles, and the default receives the unknown value", () => {
    expectTypeOf<Unrecognized<string>>().toExtend<ProductStatus>();
    const label = (status: ProductStatus): string => {
      switch (status) {
        case "active":
          return "Active";
        case "archived":
          return "Archived";
        default:
          // With a closed enum this branch would see `never`.
          expectTypeOf(status).toEqualTypeOf<Unrecognized<string>>();
          return status;
      }
    };
    expectTypeOf(label).returns.toEqualTypeOf<string>();
  });

  it("a misspelled comparison compiles (the flip side MIGRATION.md names)", () => {
    const isActive = (status: ProductStatus): boolean => status === "actve";
    expectTypeOf(isActive).returns.toEqualTypeOf<boolean>();
  });
});
