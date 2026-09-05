import { it, expect, vi } from "vitest";
import { harness } from "./helpers";
import { getProductsTuiDescriptor } from "../src/tui/products";
import { getCustomersTuiDescriptor } from "../src/tui/customers";
import { getSubscriptionsTuiDescriptor } from "../src/tui/subscriptions";
import { getTransactionsTuiDescriptor } from "../src/tui/transactions";
it("all existing TUI lists use typed SDK pages, including authoritative subscription search", async () => {
  const h = harness();
  const result = {
    result: {
      items: [],
      pagination: { currentPage: 2, totalPages: 2, totalRecords: 20, nextPage: 0, prevPage: 1 },
    },
  };
  const products = vi.spyOn(h.client.products, "search").mockResolvedValue(result as never);
  const customers = vi.spyOn(h.client.customers, "list").mockResolvedValue(result as never);
  const subscriptions = vi
    .spyOn(h.client.subscriptions, "search")
    .mockResolvedValue(result as never);
  const transactions = vi.spyOn(h.client.transactions, "search").mockResolvedValue(result as never);
  for (const descriptor of [
    getProductsTuiDescriptor(h.context),
    getCustomersTuiDescriptor(h.context),
    getSubscriptionsTuiDescriptor(h.context),
    getTransactionsTuiDescriptor(h.context),
  ])
    expect(await descriptor.fetchPage(2, 10)).toEqual({ items: [], hasMore: false, total: 20 });
  expect(products).toHaveBeenCalledWith(2, 10);
  expect(customers).toHaveBeenCalledWith(2, 10);
  expect(subscriptions).toHaveBeenCalledWith(2, 10);
  expect(transactions).toHaveBeenCalledExactlyOnceWith(undefined, undefined, undefined, 2, 10);
});
