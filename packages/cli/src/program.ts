import { Command, CommanderError } from "commander";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { operationManifest } from "./operation-manifest";
import { createContext, type CliContext } from "./lib/context";
import { CliError, describeError } from "./lib/errors";
import { createResourceCommand, addGlobalOptions, outputFormat } from "./commands/resource";
import { createLoginCommand } from "./commands/login";
import { createLogoutCommand } from "./commands/logout";
import { createWhoamiCommand } from "./commands/whoami";
import { createConfigCommand } from "./commands/config";
import { createMigrateCommand } from "./commands/migrate";
import { loadConfig } from "./lib/config";

export function createProgram(context: CliContext = createContext()): Command {
  const version = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"))
    .version as string;
  const program = addGlobalOptions(
    new Command("creem")
      .description("Manage your Creem business from the terminal")
      .version(version, "-v, --version"),
  );
  program.configureOutput({ writeOut: context.stdout, writeErr: () => {} }).exitOverride();
  for (const resource of new Set(operationManifest.map((r) => r.cliPath.split(" ")[0])))
    program.addCommand(createResourceCommand(resource, context));
  program.addCommand(createLoginCommand(context));
  program.addCommand(createLogoutCommand(context));
  program.addCommand(createWhoamiCommand(context));
  program.addCommand(createConfigCommand(context));
  program.addCommand(createMigrateCommand(context));
  program.action(() => program.outputHelp());
  const configure = (cmd: Command) => {
    cmd.configureOutput({ writeOut: context.stdout, writeErr: () => {} }).exitOverride();
    for (const child of cmd.commands) configure(child);
  };
  configure(program);
  program.hook("preAction", (_root, cmd) => {
    if (cmd.commands.length && cmd.args.length)
      throw new CliError("Unknown command. Run creem --help for available commands.");
  });
  return program;
}
export async function run(argv: string[], context: CliContext = createContext()): Promise<number> {
  const program = createProgram(context);
  const key = loadConfig().api_key;
  if (key) context.secrets.add(key);
  const loginKeyIndex = argv.indexOf("--api-key");
  if (loginKeyIndex >= 0 && argv[loginKeyIndex + 1]) context.secrets.add(argv[loginKeyIndex + 1]);
  const keyIndex = argv.indexOf("--key");
  if (keyIndex >= 0 && argv[keyIndex + 1]) context.secrets.add(argv[keyIndex + 1]);
  if (!context.isTTY || argv.includes("--no-color")) chalk.level = 0;
  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return 0;
    const { exitCode, result } = describeError(error, [...context.secrets]);
    // Parsing can fail before Commander assigns globals; honor machine output even then.
    const machine =
      argv.includes("--json") ||
      argv.some((value) => /^--output=(json|ndjson)$/.test(value)) ||
      argv.some((v, i) => v === "--output" && ["json", "ndjson"].includes(argv[i + 1])) ||
      outputFormat(program) !== "table";
    context.stderr(
      machine
        ? JSON.stringify(result) + "\n"
        : `${result.error.message}\n${result.error.cause ? `Cause: ${result.error.cause}\n` : ""}Fix: ${result.error.suggestion}${result.error.traceId ? `\nTrace ID: ${result.error.traceId}` : ""}\n`,
    );
    return exitCode;
  }
}
