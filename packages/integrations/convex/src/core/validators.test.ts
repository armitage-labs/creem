import { describe, expect, it } from "vitest";
import { creditEntryValidator } from "./validators.js";

describe("creditEntryValidator", () => {
  // ENG-2487: SDK 2.0 passes a ledger side the API adds later through as a
  // string, so the component's return validator must accept it too instead of
  // failing the whole listEntries call.
  it("accepts any ledger side the SDK returns", () => {
    expect(creditEntryValidator.fields.side.kind).toBe("string");
  });
});
