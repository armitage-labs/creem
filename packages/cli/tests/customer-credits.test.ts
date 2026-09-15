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
it("customer-credits transactions create sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "postTransaction")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "transactions",
    "create",
    "--reference",
    "order_1",
    "--idempotency-key",
    "idem",
    "--entry",
    '{"accountId":"acc_1","side":"debit","amount":"900719925474099312345"}',
    "--entry",
    '{"accountId":"acc_2","side":"credit","amount":"900719925474099312345"}',
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      reference: "order_1",
      idempotencyKey: "idem",
      entries: [
        { accountId: "acc_1", side: "debit", amount: "900719925474099312345" },
        { accountId: "acc_2", side: "credit", amount: "900719925474099312345" },
      ],
    }),
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits transactions create requires --yes in machine-output mode", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customerCredits, "postTransaction");
  const result = await h.run([
    "customer-credits",
    "transactions",
    "create",
    "--reference",
    "order_1",
    "--idempotency-key",
    "idem",
    "--entry",
    '{"accountId":"acc_1","side":"debit","amount":"1"}',
    "--json",
  ]);
  expect(spy).not.toHaveBeenCalled();
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("--yes");
});
it("customer-credits transactions get sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "getTransaction")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run(["customer-credits", "transactions", "get", "cct_1", "--json"]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cct_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits transactions reverse sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "reverseTransactionById")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "transactions",
    "reverse",
    "cct_1",
    "--yes",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "cct_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits transactions list sends the exact SDK arguments", async () => {
  const h = harness();
  const spy = vi
    .spyOn(h.client.customerCredits, "listTransactionsByReference")
    .mockRejectedValue(new Error("SDK_SENTINEL"));
  const result = await h.run([
    "customer-credits",
    "transactions",
    "list",
    "--reference",
    "order_1",
    "--json",
  ]);
  expect(spy, result.stderr).toHaveBeenCalledExactlyOnceWith(
    "order_1",
    expect.objectContaining({ retries: { strategy: "none" } }),
  );
  expect(result.stderr).toContain("SDK_SENTINEL");
  expect(result.stdout).toBe("");
});
it("customer-credits transactions list requires --reference", async () => {
  const h = harness();
  const spy = vi.spyOn(h.client.customerCredits, "listTransactionsByReference");
  const result = await h.run(["customer-credits", "transactions", "list", "--json"]);
  expect(spy).not.toHaveBeenCalled();
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("--reference is required");
});
