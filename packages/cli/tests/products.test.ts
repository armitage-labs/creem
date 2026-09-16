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
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    2,
    3,
    "archived",
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
    expect.objectContaining({
      name: "Free",
      price: 0,
      billingType: "onetime",
      payWhatYouWant: true,
      suggestedPrice: 100,
      imageUrls: ["https://example.com/1.png", "https://example.com/2.png"],
    }),
    "idem1",
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
    "prod_1",
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
    "prod_1",
    expect.objectContaining({ price: 100 }),
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
    "prod_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
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
    expect.objectContaining({
      usagePrices: body.usagePrices,
      features: body.features,
    }),
    undefined,
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
