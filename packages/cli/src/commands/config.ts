import { Command } from "commander";
import { loadConfig, saveConfig } from "../lib/config";
import { inferEnvironment, resetClient } from "../lib/api";
import { createContext, type CliContext } from "../lib/context";
import { CliError } from "../lib/errors";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";
export function createConfigCommand(context: CliContext = createContext()): Command {
  const root = addGlobalOptions(
    new Command("config").description("View and manage CLI configuration"),
  );
  const show = (cmd: Command) => {
    const config = loadConfig();
    writeResult(
      context,
      { ...config, api_key: config.api_key ? "[REDACTED]" : undefined },
      outputFormat(cmd),
    );
  };
  root.action(() => show(root));
  const command = (name: string) => {
    const c = addGlobalOptions(new Command(name));
    root.addCommand(c);
    return c;
  };
  const display = command("show").description("Display configuration");
  display.action(() => show(display));
  const get = command("get").argument("<key>").description("Get a configuration value");
  get.action((key: string) => {
    if (key === "api_key") {
      writeResult(context, { api_key: "[REDACTED]" }, outputFormat(get));
      return;
    }
    if (key !== "environment" && key !== "output_format")
      throw new CliError("Valid config keys: environment, output_format.");
    const value = loadConfig()[key];
    if (outputFormat(get) === "table") context.stdout(value + "\n");
    else writeResult(context, { [key]: value }, outputFormat(get));
  });
  const set = command("set")
    .argument("<key>")
    .argument("<value>")
    .description("Set a configuration value");
  set.action((key: string, value: string) => {
    const config = loadConfig();
    if (key === "environment" && (value === "test" || value === "live")) {
      if (config.api_key && inferEnvironment(config.api_key) !== value)
        throw new CliError(
          "Environment conflicts with stored API key. Run creem login --force with the matching key.",
          3,
        );
      config.environment = value;
    } else if (key === "output_format" && (value === "table" || value === "json"))
      config.output_format = value;
    else
      throw new CliError(
        "Use environment test|live or output_format table|json. Set credentials with creem login.",
      );
    saveConfig(config);
    resetClient();
    writeResult(context, { [key]: value }, outputFormat(set));
  });
  const list = command("list").description("List configuration keys");
  list.action(() =>
    writeResult(
      context,
      [
        { key: "environment", validValues: ["test", "live"] },
        { key: "output_format", validValues: ["table", "json"] },
      ],
      outputFormat(list),
    ),
  );
  return root;
}
