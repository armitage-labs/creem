import { Creem } from "creem";
import { vi } from "vitest";
import { createContext, type CliContext } from "../src/lib/context";
import { run } from "../src/program";
export function harness(
  client = new Creem({ apiKey: "creem_test_fixture", server: "test" }),
  overrides: Partial<CliContext> = {},
) {
  let stdout = "";
  let stderr = "";
  const context = createContext({
    client: () => client,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    isTTY: false,
    environment: () => "test",
    stdin: async () => "",
    confirm: vi.fn(async () => false),
    ...overrides,
  });
  return {
    client,
    context,
    run: async (args: string[]) => {
      stdout = "";
      stderr = "";
      const code = await run(args, context);
      return { code, stdout, stderr };
    },
  };
}
