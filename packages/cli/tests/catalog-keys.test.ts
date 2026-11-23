import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ENG-2437: the store's test and live keys of `creem catalog`, entered in the
 * terminal. A key typed for the other environment, or an empty answer, never
 * builds a client.
 */

const prompts = vi.hoisted(() => ({ password: vi.fn<() => Promise<string>>() }));
vi.mock("@inquirer/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@inquirer/prompts")>()),
  password: prompts.password,
}));

const { createContext } = await import("../src/lib/context");
const { CliError } = await import("../src/lib/errors");

const NAMES = ["CREEM_API_KEY", "CREEM_LIVE_API_KEY", "CREEM_TEST_API_KEY"] as const;
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  for (const name of NAMES) delete process.env[name];
  prompts.password.mockReset();
});
afterEach(() => {
  for (const [name, value] of Object.entries(saved))
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
});

const terminal = () => createContext({ isTTY: true, stderr: () => {} });

describe("creem catalog: a key entered in the terminal", () => {
  it("refuses a test key entered for live, with exit 3, and keeps it out of the secrets", async () => {
    prompts.password.mockResolvedValueOnce("creem_test_typed");
    const context = terminal();
    const error = await context.clientFor("live").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliError);
    expect((error as InstanceType<typeof CliError>).exitCode).toBe(3);
    expect((error as Error).message).toBe("That is a test key; enter the store's live key.");
    expect(context.secrets.has("creem_test_typed")).toBe(false);
  });

  it("refuses a live key entered for test", async () => {
    prompts.password.mockResolvedValueOnce("creem_livetyped");
    const error = await terminal()
      .clientFor("test")
      .catch((e: unknown) => e);
    expect((error as InstanceType<typeof CliError>).exitCode).toBe(3);
    expect((error as Error).message).toBe("That is a live key; enter the store's test key.");
  });

  it("refuses an empty answer, and adds nothing to the secrets", async () => {
    prompts.password.mockResolvedValueOnce("   ");
    const context = terminal();
    const before = new Set(context.secrets);
    const error = await context.clientFor("live").catch((e: unknown) => e);
    expect((error as InstanceType<typeof CliError>).exitCode).toBe(3);
    expect((error as Error).message).toBe("No live key was entered.");
    expect(context.secrets).toEqual(before);
  });

  it("trims the entered key and builds the client for its environment", async () => {
    prompts.password.mockResolvedValueOnce("  creem_livetyped \n");
    const context = terminal();
    const client = await context.clientFor("live");
    expect(client).toBeDefined();
    expect(context.secrets.has("creem_livetyped")).toBe(true);
    expect(context.secrets.has("  creem_livetyped \n")).toBe(false);
  });

  it("trims the current key too, before checking its environment", async () => {
    process.env.CREEM_API_KEY = " creem_test_current ";
    const context = terminal();
    await context.clientFor("test");
    expect(prompts.password).not.toHaveBeenCalled();
    expect(context.secrets.has("creem_test_current")).toBe(true);
  });
});
