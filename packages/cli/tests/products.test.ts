import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("products search sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "search").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "products",
    "list",
    "--page",
    "2",
    "--limit",
    "3",
    "--status",
    "archived",
    "--external-id",
    "pro-plan",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { pageNumber: 2, pageSize: 3, status: "archived", externalId: "pro-plan" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("products create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "products",
    "create",
    "--name",
    "Free",
    "--description",
    "A free product",
    "--price",
    "0",
    "--currency",
    "USD",
    "--billing-type",
    "onetime",
    "--pay-what-you-want",
    "--suggested-price",
    "100",
    "--image-url",
    "https://example.com/1.png",
    "--image-url",
    "https://example.com/2.png",
    "--idempotency-key",
    "idem1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      createProductRequestEntity: expect.objectContaining({
        name: "Free",
        price: 0,
        billingType: "onetime",
        payWhatYouWant: true,
        suggestedPrice: 100,
        imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
      }),
      idempotencyKey: "idem1",
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("products get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "get").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["products", "get", "prod_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "prod_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("products update sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["products", "update", "prod_1", "--price", "100", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "prod_1", updateProductRequestEntity: expect.objectContaining({ price: 100 }) },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("products archive sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "archive").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["products", "archive", "prod_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "prod_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});

it("products prices sends the exact SDK arguments and prints the price versions as JSON", async () => {
  const h = harness();
  const versions = {
    items: [{ id: "pver_2" }, { id: "pver_1" }],
    subscriptionsWithoutPriceVersion: { active: 0 },
  };
  const spy = vi.spyOn(h.client.products, "listPrices").mockResolvedValue(versions as never);
  const result = await h.run(["products", "prices", "prod_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    { id: "prod_1" },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.code, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(versions);
});
it("products prices requires the product ID and documents it in --help", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "listPrices");
  const missing = await h.run(["products", "prices", "--json"]);
  expect(missing.code).toBe(2);
  expect(spy).not.toHaveBeenCalled();
  const help = await h.run(["products", "prices", "--help"]);
  expect(help.code, help.stderr).toBe(0);
  expect(help.stdout).toContain("prices [options] <id>");
  expect(help.stdout).toContain("--json also returns subscriptionsWithoutPriceVersion");
});
it("products prices table output shows which price version is current", async () => {
  const h = harness();
  vi.spyOn(h.client.products, "listPrices").mockResolvedValue({
    items: [
      { id: "pver_2", price: 2000, currency: "EUR", current: true },
      { id: "pver_1", price: 1000, currency: "EUR", current: false },
    ],
    subscriptionsWithoutPriceVersion: { active: 0 },
  } as never);
  const result = await h.run(["products", "prices", "prod_1", "--output", "table"]);
  expect(result.code, result.stderr).toBe(0);
  const rows = result.stdout
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  expect(rows).toEqual([
    ["id", "price", "currency", "current"],
    ["pver_2", "2000", "EUR", "true"],
    ["pver_1", "1000", "EUR", "false"],
  ]);
});
it("products create passes usagePrices and features through --data untouched", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "create").mockRejectedValue(new Error("SDK_SENTINEL"));
  const body = {
    name: "Pro plan",
    description: "Base fee plus per-image usage",
    price: 1000,
    currency: "EUR",
    billingType: "recurring",
    billingPeriod: "every-month",
    usagePrices: [
      {
        meterId: "mtr_1",
        unitPrice: 2,
        freeAllowance: 100,
        settlementMode: "prepaid",
        targetAccount: "per_unit",
      },
    ],
    features: [
      {
        type: "customerCredits",
        description: "500 image credits",
        customerCredits: { amount: "500", unitLabel: "images", bucketName: "images" },
      },
    ],
  };
  const result = await h.run(["products", "create", "--data", JSON.stringify(body), "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    {
      createProductRequestEntity: expect.objectContaining({
        usagePrices: body.usagePrices,
        features: body.features,
      }),
    },
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
});

it("products update rejects a usage price with an unknown settlement mode before calling the SDK", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.products, "update").mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "products",
    "update",
    "prod_1",
    "--data",
    JSON.stringify({
      usagePrices: [{ meterId: "mtr_1", unitPrice: 1, settlementMode: "monthly" }],
    }),
    "--yes",
    "--json",
  ]);
  expect(spy).not.toHaveBeenCalled();
  expect(result.stderr).toMatch(/settlementMode/);
});
