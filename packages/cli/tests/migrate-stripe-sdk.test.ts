import { afterEach, expect, it, vi } from "vitest";
import { withoutClaudeCodeHint } from "../src/lib/migration/stripe/source";

/**
 * The Stripe SDK writes a Claude Code plugin hint to stderr when it loads with
 * `CLAUDECODE` or `CLAUDE_CODE_CHILD_SESSION` set (stripe-node #2805, since
 * 22.5.0). The CLI's stderr carries only its own output, so the SDK loads with
 * both hidden, and only when `creem migrate stripe` reads Stripe. The packed
 * check (`scripts/test-packed.mjs`) runs the CLI with `CLAUDECODE` set.
 */

afterEach(() => vi.unstubAllEnvs());

it("loads with CLAUDECODE and CLAUDE_CODE_CHILD_SESSION hidden, and restores them", () => {
  vi.stubEnv("CLAUDECODE", "1");
  vi.stubEnv("CLAUDE_CODE_CHILD_SESSION", "1");
  const seen = withoutClaudeCodeHint(() => [
    process.env.CLAUDECODE,
    process.env.CLAUDE_CODE_CHILD_SESSION,
  ]);
  expect(seen).toEqual([undefined, undefined]);
  expect(process.env.CLAUDECODE).toBe("1");
  expect(process.env.CLAUDE_CODE_CHILD_SESSION).toBe("1");
});

it("restores them when loading throws, and adds none that weren't set", () => {
  vi.stubEnv("CLAUDECODE", "1");
  delete process.env.CLAUDE_CODE_CHILD_SESSION;
  expect(() =>
    withoutClaudeCodeHint(() => {
      throw new Error("load failed");
    }),
  ).toThrow("load failed");
  expect(process.env.CLAUDECODE).toBe("1");
  expect("CLAUDE_CODE_CHILD_SESSION" in process.env).toBe(false);
});
