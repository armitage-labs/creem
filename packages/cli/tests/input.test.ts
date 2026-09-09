import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseInteger, parseDate, parseKeyValue, readData } from "../src/lib/input";
import { harness } from "./helpers";
describe("input", () => {
  it.each(["1x", "1.2", "NaN", "Infinity", "1e3", "9007199254740993", "-1"])(
    "rejects invalid integer %s",
    (v) => expect(() => parseInteger("amount", v)).toThrow(),
  );
  it("allows zero and preserves duplicate metadata semantics", () => {
    expect(parseInteger("price", "0")).toBe(0);
    expect(parseKeyValue(["x=a=b", "x=last"])).toEqual({ x: "last" });
  });
  it.each(["2024-02-30", "yesterday", "2024-13-01"])("rejects invalid date %s", (v) =>
    expect(() => parseDate("date", v)).toThrow(),
  );
  it("reads JSON, files, stdin; rejects invalid input", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cli-input-"));
    try {
      await writeFile(join(dir, "input.json"), '{"name":"file"}');
      expect(await readData("@" + join(dir, "input.json"), async () => "")).toEqual({
        name: "file",
      });
      expect(await readData("-", async () => '{"name":"stdin"}')).toEqual({ name: "stdin" });
      await expect(readData("[]", async () => "")).rejects.toThrow();
      await expect(readData("@" + dir + "/absent", async () => "")).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each([
    ["products", "create", "--data", "{}", "--name", "x"],
    [
      "products",
      "create",
      "--data",
      '{"name":"x","description":"x","price":12,"currency":"USD","billingType":"onetime"}',
    ],
    ["products", "update", "prod_1", "--data", "{}", "--yes"],
    [
      "products",
      "update",
      "prod_1",
      "--data",
      '{"billingPeriod":"custom","recurringInterval":"year","recurringIntervalCount":4}',
      "--yes",
    ],
    ["products", "update", "prod_1", "--data", '{"recurringInterval":"month"}', "--yes"],
    [
      "checkouts",
      "create",
      "--product",
      "p",
      "--customer",
      "c",
      "--customer-email",
      "a@example.com",
    ],
    ["checkouts", "create", "--product", "p", "--units", "0"],
    ["checkouts", "create", "--product", "p", "--custom-price", "99"],
    ["customers", "update", "c", "--data", '{"customerId":"other","name":"x"}', "--yes"],
    ["customers", "create", "--data", '{"email":"a","name":"b","typo":true}'],
    ["customer-credits", "list", "--starting-after", "a", "--ending-before", "b"],
    [
      "customer-credits",
      "credit",
      "a",
      "--amount",
      "1.5",
      "--reference",
      "r",
      "--idempotency-key",
      "i",
    ],
    ["stats", "summary", "--currency", "USD", "--interval", "day"],
    ["stats", "summary", "--currency", "USD", "--start-date", "2", "--end-date", "1"],
    ["subscriptions", "cancel", "a", "--mode", "garbage", "--yes"],
    ["subscriptions", "update", "a", "--data", '{"items":[]}', "--yes"],
    ["subscriptions", "list", "--status", "active", "--page", "1"],
    ["discounts", "list", "--created-after", "yesterday"],
    [
      "splits",
      "create",
      "--type",
      "store",
      "--type-reference",
      "s",
      "--recipient",
      '{"recipientType":"store","recipientReference":"s1","amount":70}',
      "--recipient",
      '{"recipientType":"store","recipientReference":"s2","amount":70}',
    ],
  ])("rejects invalid operation input: %s %s", async (...args) => {
    const r = await harness().run([...args, "--json"]);
    expect(r.code, r.stderr).toBe(2);
    expect(r.stdout).toBe("");
    expect(JSON.parse(r.stderr).error.suggestion).toBeTruthy();
  });
});

it("validates calendar dates independently of timezone offsets", () => {
  expect(() => parseDate("at", "2024-02-30T12:00:00+02:00")).toThrow();
  expect(parseDate("at", "2024-02-29T23:00:00-02:00")).toBe("2024-02-29T23:00:00-02:00");
});
