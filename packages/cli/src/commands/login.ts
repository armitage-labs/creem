import { Command } from "commander";
import { password } from "@inquirer/prompts";
import { loginWithApiKey } from "../lib/auth";
import { loadConfig } from "../lib/config";
import { createContext, type CliContext } from "../lib/context";
import { CliError } from "../lib/errors";
import { inferEnvironment } from "../lib/api";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";

export function createLoginCommand(context: CliContext = createContext()): Command {
  const command = addGlobalOptions(
    new Command("login").description("Authenticate and store a key locally"),
  )
    .option("--api-key <key>", "API key (prefer CREEM_API_KEY or masked prompt)")
    .option("-f, --force", "Replace existing stored credentials");
  command.action(async () => {
    const opts = command.optsWithGlobals();
    if (loadConfig().api_key && !opts.force) {
      writeResult(
        context,
        { success: true, message: "Already logged in. Use --force to replace stored credentials." },
        outputFormat(command),
      );
      return;
    }
    let key = opts.apiKey ?? process.env.CREEM_API_KEY;
    if (key === undefined) {
      if (!context.isTTY || outputFormat(command) !== "table")
        throw new CliError("Login requires CREEM_API_KEY in non-interactive mode.", 3);
      key = await password({ message: "API key:", mask: "*" }, { output: process.stderr });
    }
    if (typeof key !== "string" || !key.trim()) throw new CliError("API key cannot be empty.", 3);
    context.secrets.add(key);
    const environment = inferEnvironment(key.trim());
    if (opts.environment && environment !== opts.environment)
      throw new CliError("API key and selected environment do not match.", 3);
    const result = await loginWithApiKey(key);
    if (!result.success)
      throw new CliError(
        result.message,
        3,
        "Check the API key and connectivity, then run creem login again.",
      );
    writeResult(context, result, outputFormat(command));
  });
  return command;
}
