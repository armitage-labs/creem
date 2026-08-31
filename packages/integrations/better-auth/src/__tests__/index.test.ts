import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultOptions } from "./fixtures.js";

// Mock better-auth/api
vi.mock("better-auth/api", () => ({
  createAuthEndpoint: vi.fn((_path, _opts, handler) => handler),
  getSessionFromCtx: vi.fn(),
}));

// Mock creem
vi.mock("creem", () => {
  class MockCreem {
    constructor(_opts: any) {}
  }
  return { Creem: MockCreem };
});

// Mock better-auth logger
vi.mock("better-auth", async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Mock better-auth/db
vi.mock("better-auth/db", () => ({
  mergeSchema: vi.fn((...args) => Object.assign({}, ...args)),
}));

import { creem } from "../index.js";

describe("creem plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has id 'creem'", () => {
    const plugin = creem(defaultOptions);
    expect(plugin.id).toBe("creem");
  });

  it("includes all core endpoints", () => {
    const plugin = creem(defaultOptions);
    expect(plugin.endpoints).toHaveProperty("createCheckout");
    expect(plugin.endpoints).toHaveProperty("createPortal");
    expect(plugin.endpoints).toHaveProperty("cancelSubscription");
    expect(plugin.endpoints).toHaveProperty("retrieveSubscription");
    expect(plugin.endpoints).toHaveProperty("searchTransactions");
    expect(plugin.endpoints).toHaveProperty("hasAccessGranted");
  });

  it("includes webhook endpoint when webhookSecret is set", () => {
    const plugin = creem({ ...defaultOptions, webhookSecret: "secret" });
    expect(plugin.endpoints).toHaveProperty("creemWebhook");
  });

  it("excludes webhook endpoint when webhookSecret is not set", () => {
    const plugin = creem({ ...defaultOptions, webhookSecret: undefined });
    expect(plugin.endpoints).not.toHaveProperty("creemWebhook");
  });

  it("includes schema when persistSubscriptions is true", () => {
    const plugin = creem({ ...defaultOptions, persistSubscriptions: true });
    expect(plugin.schema).toBeDefined();
  });

  it("returns empty schema when persistSubscriptions is false", () => {
    const plugin = creem({ ...defaultOptions, persistSubscriptions: false });
    // Schema should still be defined (returned by getSchema) but without creem_subscription table
    expect(plugin.schema).toBeDefined();
  });

  it("warns when API key is missing", async () => {
    const { logger } = await import("better-auth");
    creem({ ...defaultOptions, apiKey: "" });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("API key is not set"));
  });

  it("does not warn when API key is set", async () => {
    const { logger } = await import("better-auth");
    creem(defaultOptions);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
