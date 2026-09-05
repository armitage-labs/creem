import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
it("customer-credits createAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "createAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "create",
    "--customer",
    "cust_1",
    "--initial-balance",
    "900719925474099312345",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ customerId: "cust_1", initialBalance: "900719925474099312345" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits listAccounts sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "listAccounts")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "list",
    "--limit",
    "3",
    "--customer",
    "cust_1",
    "--starting-after",
    "acc_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    3,
    "cust_1",
    "acc_1",
    undefined,
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits getAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "getAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customer-credits", "get", "acc_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits getAccountBalance sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "getAccountBalance")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "balance",
    "acc_1",
    "--at",
    "2024-01-01T00:00:00Z",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    "2024-01-01T00:00:00Z",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits listEntries sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "listEntries")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "entries",
    "acc_1",
    "--limit",
    "3",
    "--ending-before",
    "ent_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    3,
    undefined,
    "ent_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits freezeAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "freezeAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customer-credits", "freeze", "acc_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits unfreezeAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "unfreezeAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customer-credits", "unfreeze", "acc_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits creditAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "creditAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "credit",
    "acc_1",
    "--amount",
    "900719925474099312345",
    "--reference",
    "ref",
    "--idempotency-key",
    "idem",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({
      amount: "900719925474099312345",
      reference: "ref",
      idempotencyKey: "idem",
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits debitAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "debitAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "debit",
    "acc_1",
    "--amount",
    "20",
    "--reference",
    "ref",
    "--idempotency-key",
    "idem",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ amount: "20", reference: "ref", idempotencyKey: "idem" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits reverseTransaction sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "reverseTransaction")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "reverse",
    "acc_1",
    "--transaction",
    "tx_1",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ transactionId: "tx_1" }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits closeAccount sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "closeAccount")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customer-credits", "close", "acc_1", "--yes", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "acc_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
