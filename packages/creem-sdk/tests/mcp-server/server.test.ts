import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMCPServer } from "../../src/mcp-server/server.js";
import { TEST_API_KEY, TEST_SERVER_IDX } from "../fixtures/testValues.js";
import type { ConsoleLogger } from "../../src/mcp-server/console-logger.js";

// Mock logger that matches ConsoleLogger interface
const createMockLogger = (): ConsoleLogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
});

describe("MCP Server", () => {
  let mockLogger: ConsoleLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should create MCP server instance", () => {
    const server = createMCPServer({
      logger: mockLogger,
      apiKey: TEST_API_KEY,
      serverIdx: TEST_SERVER_IDX,
    });

    expect(server).toBeDefined();
  });

  it("should register tools when created", () => {
    createMCPServer({
      logger: mockLogger,
      apiKey: TEST_API_KEY,
      serverIdx: TEST_SERVER_IDX,
    });

    // Verify tools were registered via logger debug calls
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it("should register expected number of tools", () => {
    createMCPServer({
      logger: mockLogger,
      apiKey: TEST_API_KEY,
      serverIdx: TEST_SERVER_IDX,
    });

    // Count the number of "Registered tool" debug calls
    const debugCalls = vi.mocked(mockLogger.debug).mock.calls;
    const toolRegistrationCalls = debugCalls.filter(
      (call) => call[0] === "Registered tool"
    );

    // Expected tools based on server.ts imports:
    // products: get, create, search (3)
    // customers: list, retrieve, generateBillingLinks (3)
    // subscriptions: get, cancel, update, upgrade, pause, resume (6)
    // checkouts: retrieve, create (2)
    // licenses: activate, deactivate, validate (3)
    // discounts: get, create, delete (3)
    // transactions: getById, search (2)
    // Total: 22 tools
    expect(toolRegistrationCalls.length).toBe(22);
  });

  it("should create server with custom server URL", () => {
    const customServerURL = "https://custom-api.creem.io";

    const server = createMCPServer({
      logger: mockLogger,
      apiKey: TEST_API_KEY,
      serverURL: customServerURL,
    });

    expect(server).toBeDefined();
  });

  it("should filter tools when allowedTools is provided", () => {
    createMCPServer({
      logger: mockLogger,
      apiKey: TEST_API_KEY,
      serverIdx: TEST_SERVER_IDX,
      allowedTools: ["products-get", "products-search"],
    });

    // Only allowed tools should be registered
    const debugCalls = vi.mocked(mockLogger.debug).mock.calls;
    const toolRegistrationCalls = debugCalls.filter(
      (call) => call[0] === "Registered tool"
    );

    expect(toolRegistrationCalls.length).toBe(2);
  });

  it("should create server without API key (will fail at runtime)", () => {
    // Server can be created without API key, but API calls will fail
    const server = createMCPServer({
      logger: mockLogger,
      serverIdx: TEST_SERVER_IDX,
    });

    expect(server).toBeDefined();
  });
});
