import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import { createCreemAuthClient } from "../create-creem-auth-client.js";
import { APIError } from "better-auth/api";
import { creem } from "../index.js";
import { creemClient } from "../client.js";
import { createMockCreem, mockDbSubscription, mockUser } from "./fixtures.js";

const { getSession, sdk } = vi.hoisted(() => ({
  getSession: vi.fn(),
  sdk: { current: null as any },
}));

// Keep routing, validation, errors and client behavior real. Only authentication
// and the payment provider are replaced; requests never leave this process.
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getSessionFromCtx: (...args: unknown[]) => getSession(...args),
}));
vi.mock("creem", () => ({
  Creem: vi.fn(function () {
    return sdk.current;
  }),
}));

function setup(options: { apiKey?: string; persistSubscriptions?: boolean } = {}) {
  const database = {
    user: [mockUser],
    session: [],
    account: [],
    verification: [],
    creem_subscription: [{ ...mockDbSubscription }],
  };
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "native-client-contract-tests-secret-123456789",
    database: memoryAdapter(database),
    logger: { disabled: true },
    plugins: [creem({ apiKey: "test_key", ...options })],
  });
  const clientOptions = {
    baseURL: "http://localhost:3000",
    plugins: [creemClient()],
    fetchOptions: {
      customFetchImpl: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        auth.handler(new Request(input, init)),
    },
  };
  const client = createAuthClient(clientOptions);
  const reactClient = createReactAuthClient(clientOptions);
  const wrapper = createCreemAuthClient(clientOptions);
  return { auth, client, reactClient, wrapper, database };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.current = createMockCreem();
  sdk.current.transactions.search.mockResolvedValue({
    result: {
      items: [{ id: "txn_1", amount: 1000, currency: "USD" }],
      pagination: {
        totalRecords: 1,
        totalPages: 1,
        currentPage: 1,
        nextPage: null,
        prevPage: null,
      },
    },
  });
  getSession.mockResolvedValue({ user: mockUser });
});
afterEach(() => vi.unstubAllGlobals());

describe("native client through the Better Auth HTTP handler", () => {
  it.each(["client", "reactClient", "wrapper"] as const)(
    "returns successful data for every Creem method through %s",
    async (kind) => {
      const client = setup()[kind];
      expect(await client.creem.createCheckout({ productId: "prod_1" })).toEqual({
        data: { url: "https://checkout.creem.io/test-session", redirect: false },
        error: null,
      });
      expect(await client.creem.createPortal()).toEqual({
        data: { url: "https://portal.creem.io/test-portal", redirect: false },
        error: null,
      });
      expect(await client.creem.cancelSubscription({})).toEqual({
        data: { success: true, message: "Subscription cancelled successfully" },
        error: null,
      });
      expect(await client.creem.retrieveSubscription({})).toMatchObject({
        data: { id: "sub_test_789", status: "active" },
        error: null,
      });
      expect(await client.creem.searchTransactions()).toMatchObject({
        data: { items: [{ id: "txn_1" }], pagination: { totalRecords: 1 } },
        error: null,
      });
      expect(await client.creem.hasAccessGranted()).toMatchObject({
        data: { hasAccessGranted: true, subscription: { id: mockDbSubscription.id } },
        error: null,
      });
    },
  );

  it.each([
    ["createCheckout", { productId: "prod_1" }, "checkouts", "create", "Failed to create checkout"],
    ["createPortal", {}, "customers", "generateBillingLinks", "Failed to create portal"],
    ["cancelSubscription", {}, "subscriptions", "cancel", "Failed to cancel subscription"],
    ["retrieveSubscription", {}, "subscriptions", "get", "Failed to retrieve subscription"],
    ["searchTransactions", {}, "transactions", "search", "Failed to search transactions"],
  ] as const)(
    "puts %s provider failures in error and throws for direct server calls",
    async (method, body, group, action, message) => {
      const { auth, client } = setup();
      sdk.current[group][action].mockRejectedValue(new Error("private provider details"));
      expect(await client.creem[method](body as never)).toMatchObject({
        data: null,
        error: { status: 500, message },
      });
      await expect(auth.api[method]({ body: body as never })).rejects.toMatchObject({
        status: "INTERNAL_SERVER_ERROR",
        body: { message },
      });
    },
  );

  it("treats a checkout without a URL as a failure rather than successful data", async () => {
    const { auth, client } = setup();
    sdk.current.checkouts.create.mockResolvedValue({});
    expect(await client.creem.createCheckout({ productId: "prod_1" })).toMatchObject({
      data: null,
      error: { status: 500 },
    });
    await expect(auth.api.createCheckout({ body: { productId: "prod_1" } })).rejects.toMatchObject({
      status: "INTERNAL_SERVER_ERROR",
    });
  });

  it("puts access-check failures in error and throws for direct server calls", async () => {
    const { auth, client } = setup({ persistSubscriptions: false });
    expect(await client.creem.hasAccessGranted()).toMatchObject({
      data: null,
      error: { status: 400, message: expect.stringContaining("persistence is disabled") },
    });
    await expect(auth.api.hasAccessGranted({})).rejects.toBeInstanceOf(APIError);
  });

  it("reports unexpected access-check database failures as 500 errors", async () => {
    const { auth, client } = setup();
    const context = await auth.$context;
    vi.spyOn(context.adapter, "findMany").mockRejectedValue(new Error("private database details"));
    expect(await client.creem.hasAccessGranted()).toMatchObject({
      data: null,
      error: { status: 500, message: "Failed to check subscription status" },
    });
    await expect(auth.api.hasAccessGranted({})).rejects.toMatchObject({
      status: "INTERNAL_SERVER_ERROR",
      body: { message: "Failed to check subscription status" },
    });
  });

  it.each([
    "createPortal",
    "cancelSubscription",
    "retrieveSubscription",
    "searchTransactions",
  ] as const)(
    "preserves %s authentication errors instead of converting them to 500",
    async (method) => {
      const { auth, client } = setup();
      getSession.mockResolvedValue(null);
      expect(await client.creem[method]({})).toMatchObject({
        data: null,
        error: { status: 400, message: "User must be logged in" },
      });
      await expect(auth.api[method]({ body: {} })).rejects.toMatchObject({
        status: "BAD_REQUEST",
        body: { message: "User must be logged in" },
      });
    },
  );

  it("preserves access-check authentication errors", async () => {
    const { auth, client } = setup();
    getSession.mockResolvedValue(null);
    expect(await client.creem.hasAccessGranted()).toMatchObject({
      data: null,
      error: { status: 401 },
    });
    await expect(auth.api.hasAccessGranted({})).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });

  it.each(["cancelSubscription", "retrieveSubscription"] as const)(
    "preserves %s missing-subscription errors",
    async (method) => {
      const { auth, client, database } = setup();
      database.creem_subscription.length = 0;
      expect(await client.creem[method]({})).toMatchObject({ data: null, error: { status: 404 } });
      await expect(auth.api[method]({ body: {} })).rejects.toMatchObject({ status: "NOT_FOUND" });
    },
  );

  it("validates checkout input before calling the payment provider", async () => {
    const { auth, client } = setup();
    // Bypass TypeScript to exercise requests from an untyped caller.
    expect(await client.creem.createCheckout({ productId: 123 } as never)).toMatchObject({
      data: null,
      error: { status: 400 },
    });
    expect(sdk.current.checkouts.create).not.toHaveBeenCalled();
    await expect(
      auth.api.createCheckout({ body: { productId: 123 } as never }),
    ).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringContaining("productId") },
    });
  });

  it.each([undefined, false, true])(
    "checkout and portal redirect only when redirect=%s is true",
    async (redirect) => {
      const { client } = setup();
      const navigate = vi.fn();
      vi.stubGlobal("window", {
        location: {
          set href(value: string) {
            navigate(value);
          },
        },
      });
      const checkout = await client.creem.createCheckout({
        productId: "prod_1",
        ...(redirect === undefined ? {} : { redirect }),
      });
      expect(checkout.data?.redirect).toBe(redirect === true);
      const portal = await client.creem.createPortal(
        redirect === undefined ? undefined : { redirect },
      );
      expect(portal.data?.redirect).toBe(redirect === true);
      if (redirect) expect(navigate.mock.calls).toEqual([[checkout.data?.url], [portal.data?.url]]);
      else expect(navigate).not.toHaveBeenCalled();
    },
  );
});
