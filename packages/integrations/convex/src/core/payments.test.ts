import { describe, expect, it } from "vitest";
import {
  parseCheckoutSuccessParams,
  hasCheckoutSuccessParams,
} from "./payments.js";

describe("parseCheckoutSuccessParams", () => {
  it("parses a full query string with leading ?", () => {
    const result = parseCheckoutSuccessParams(
      "?checkout_id=chk_1&order_id=ord_2&customer_id=cus_3&product_id=prod_4&request_id=req_5&signature=sig_6",
    );
    expect(result).toEqual({
      checkoutId: "chk_1",
      orderId: "ord_2",
      customerId: "cus_3",
      productId: "prod_4",
      requestId: "req_5",
      signature: "sig_6",
    });
  });

  it("parses a query string without leading ?", () => {
    const result = parseCheckoutSuccessParams(
      "checkout_id=chk_1&order_id=ord_2",
    );
    expect(result.checkoutId).toBe("chk_1");
    expect(result.orderId).toBe("ord_2");
  });

  it("returns undefined for missing params", () => {
    const result = parseCheckoutSuccessParams("");
    expect(result.checkoutId).toBeUndefined();
    expect(result.orderId).toBeUndefined();
    expect(result.customerId).toBeUndefined();
    expect(result.productId).toBeUndefined();
    expect(result.requestId).toBeUndefined();
    expect(result.signature).toBeUndefined();
  });

  it("accepts a URLSearchParams instance", () => {
    const params = new URLSearchParams({
      checkout_id: "chk_url",
      order_id: "ord_url",
    });
    const result = parseCheckoutSuccessParams(params);
    expect(result.checkoutId).toBe("chk_url");
    expect(result.orderId).toBe("ord_url");
  });
});

describe("hasCheckoutSuccessParams", () => {
  it("returns true when both checkoutId and orderId are present", () => {
    expect(
      hasCheckoutSuccessParams({ checkoutId: "chk_1", orderId: "ord_1" }),
    ).toBe(true);
  });

  it("returns false when checkoutId is missing", () => {
    expect(hasCheckoutSuccessParams({ orderId: "ord_1" })).toBe(false);
  });

  it("returns false when orderId is missing", () => {
    expect(hasCheckoutSuccessParams({ checkoutId: "chk_1" })).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(hasCheckoutSuccessParams({})).toBe(false);
  });
});
