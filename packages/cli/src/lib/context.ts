import type { Creem } from "creem";
import { confirm } from "@inquirer/prompts";
import { getClient, resolveAuth } from "./api";

export interface CliContext {
  client: (options: { environment?: "test" | "live"; timeout?: number }) => Creem;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  stdin: () => Promise<string>;
  isTTY: boolean;
  environment: () => "test" | "live";
  confirm: (message: string) => Promise<boolean>;
  secrets: Set<string>;
}
export function createContext(overrides: Partial<CliContext> = {}): CliContext {
  return {
    client: getClient,
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
    secrets: new Set(process.env.CREEM_API_KEY ? [process.env.CREEM_API_KEY] : []),
    ...overrides,
  };
}
