import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
import { writeResult } from "../src/utils/results";
it.each([
  ["--json", "customers", "get", "c"],
  ["customers", "--json", "get", "c"],
  ["customers", "get", "c", "--json"],
  ["customers", "get", "c", "--output", "json"],
])("global output placement: %s", async (...args) => {
  const h = harness();
  vi.spyOn(h.client.customers, "retrieve").mockResolvedValue({ id: "c" } as never);
  const r = await h.run(args);
  expect(r.code, r.stderr).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ id: "c" });
  expect(r.stderr).toBe("");
  expect(r.stdout).not.toContain("\u001b");
});
it("human license output masks full keys and API secrets", () => {
  const stdout = vi.fn();
  const h = harness(undefined, { stdout });
  writeResult(
    h.context,
    { key: "secret-license", apiKey: "creem_test_fixture", id: "lic_1" },
    "table",
  );
  const output = stdout.mock.calls.flat().join("");
  expect(output).not.toContain("secret-license");
  expect(output).not.toContain("creem_test_fixture");
});
it("JSON large integer values do not lose precision", () => {
  const stdout = vi.fn();
  const h = harness(undefined, { stdout });
  writeResult(h.context, { balance: 900719925474099312345n }, "json");
  expect(JSON.parse(stdout.mock.calls[0][0]).balance).toBe("900719925474099312345");
});

it("human output preserves SDK Date values", () => {
  const stdout = vi.fn();
  const h = harness(undefined, { stdout });
  writeResult(h.context, { createdAt: new Date("2024-01-01T00:00:00Z") }, "table");
  expect(stdout.mock.calls[0][0]).toContain("2024-01-01T00:00:00.000Z");
});
it("equals-form machine output still receives structured parse errors", async () => {
  const r = await harness().run(["products", "list", "--page", "bad", "--output=json"]);
  expect(r.code).toBe(2);
  expect(JSON.parse(r.stderr).error.type).toBe("validation");
});
