import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest } from "../request";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const request = createRequest("test-api-key", "https://test-api.creem.io");

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(data),
  };
}

describe("createRequest", () => {
  it("constructs URL from base + path", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("GET", "/v1/products");

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.origin).toBe("https://test-api.creem.io");
    expect(url.pathname).toBe("/v1/products");
  });

  it("appends query params to URL", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("GET", "/v1/products", undefined, {
      product_id: "prod_123",
      page_number: 1,
    });

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("product_id")).toBe("prod_123");
    expect(url.searchParams.get("page_number")).toBe("1");
  });

  it("skips undefined query params", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("GET", "/v1/products", undefined, {
      product_id: "prod_123",
      page_number: undefined,
    });

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("product_id")).toBe("prod_123");
    expect(url.searchParams.has("page_number")).toBe(false);
  });

  it("sets correct headers", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("GET", "/v1/products");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["x-api-key"]).toBe("test-api-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["User-Agent"]).toBe("creem-sdk-node/0.5.0");
  });

  it("does not send body for GET requests", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("GET", "/v1/products");

    expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
  });

  it("sends JSON body for POST requests", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));
    await request("POST", "/v1/checkouts", { product_id: "prod_123" });

    expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ product_id: "prod_123" }));
  });

  it("converts response keys from snake_case to camelCase", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        product_id: "prod_123",
        billing_type: "recurring",
        nested_obj: { inner_key: "val" },
      }),
    );

    const result = await request<any>("GET", "/v1/products");
    expect(result.productId).toBe("prod_123");
    expect(result.billingType).toBe("recurring");
    expect(result.nestedObj.innerKey).toBe("val");
  });

  it("returns empty object for 204 No Content", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
    });

    const result = await request("DELETE", "/v1/resource/123");
    expect(result).toEqual({});
  });

  it("throws error with message from JSON error body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ message: "Invalid product ID" }),
    });

    await expect(request("GET", "/v1/products")).rejects.toThrow("Invalid product ID");
  });

  it("falls back to statusText when error body is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(request("GET", "/v1/products")).rejects.toThrow("Internal Server Error");
  });

  it("uses statusText when JSON body has no message field", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: () => Promise.resolve({ error: "some error" }),
    });

    await expect(request("GET", "/v1/products")).rejects.toThrow("Unprocessable Entity");
  });
});
