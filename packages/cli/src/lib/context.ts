import type { Creem } from "creem";
import { confirm, input, password, select } from "@inquirer/prompts";
import { environmentApiKey, getClient, getEnvironmentClient, resolveAuth } from "./api";
import { CliError } from "./errors";

export interface Choice<T> {
  name: string;
  value: T;
}
export interface CliContext {
  client: (options: { environment?: "test" | "live"; timeout?: number }) => Creem;
  /**
   * A client for one environment of the store, with that environment's key,
   * for the commands that work on test and live together (`creem catalog`).
   */
  clientFor: (environment: "test" | "live", options?: { timeout?: number }) => Promise<Creem>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  stdin: () => Promise<string>;
  isTTY: boolean;
  environment: () => "test" | "live";
  confirm: (message: string) => Promise<boolean>;
  /** A text answer; an empty answer takes `defaultValue`. */
  ask: (message: string, defaultValue?: string) => Promise<string>;
  /** One of `choices`, picked in the terminal. */
  choose: <T>(message: string, choices: Choice<T>[]) => Promise<T>;
  secrets: Set<string>;
}
export function createContext(overrides: Partial<CliContext> = {}): CliContext {
  const context: CliContext = {
    client: getClient,
    clientFor: async (environment, options = {}) => {
      let apiKey = environmentApiKey(environment);
      if (!apiKey) {
        const name = environment === "live" ? "CREEM_LIVE_API_KEY" : "CREEM_TEST_API_KEY";
        if (!context.isTTY)
          throw new CliError(
            `No ${environment} API key.`,
            3,
            `Set ${name} to the store's ${environment} key, or run the command in a terminal to enter it.`,
          );
        apiKey = await password(
          {
            message: `The store's ${environment} API key (used for this command only, not saved)`,
            mask: "*",
          },
          { output: process.stderr },
        );
      }
      context.secrets.add(apiKey);
      return getEnvironmentClient(environment, apiKey, options.timeout);
    },
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    stdin: async () => {
      let text = "";
      for await (const chunk of process.stdin) text += chunk;
      return text;
    },
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    environment: () => resolveAuth().environment,
    confirm: (message) => confirm({ message, default: false }, { output: process.stderr }),
    ask: (message, defaultValue) =>
      input({ message, default: defaultValue }, { output: process.stderr }),
    choose: (message, choices) => select({ message, choices }, { output: process.stderr }),
    secrets: new Set(process.env.CREEM_API_KEY ? [process.env.CREEM_API_KEY] : []),
    ...overrides,
  };
  return context;
}
