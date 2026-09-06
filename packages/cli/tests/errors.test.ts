import { it, expect } from "vitest";
import { RequestTimeoutError, SDKValidationError } from "creem/models/errors";
import { describeError, CliError } from "../src/lib/errors";
it("timeout has network exit code and repair guidance", () => {
  const r = describeError(new RequestTimeoutError("timed out"));
  expect(r.exitCode).toBe(5);
  expect(r.result.error.suggestion).toContain("--timeout");
});
it("SDK input failures have validation exit code without exposing secret values", () => {
  const r = describeError(
    new SDKValidationError("Bad input", new Error("license-secret"), { key: "license-secret" }),
    ["license-secret"],
  );
  expect(r.exitCode).toBe(2);
  expect(JSON.stringify(r)).not.toContain("license-secret");
});
it("unexpected failures and auth failures have distinct exits", () => {
  expect(describeError(new Error("oops")).exitCode).toBe(1);
  expect(describeError(new CliError("auth", 3)).exitCode).toBe(3);
});

it("redacts secrets containing JSON escape characters", () => {
  const secret = 'license-"quoted"-\\key';
  const result = describeError(new Error(`Rejected ${secret}`), [secret]);
  expect(result.result.error.message).toBe("Rejected [REDACTED]");
});
