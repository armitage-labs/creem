import { Command } from "commander";
import {
  loadConfig,
  setConfigValue,
  getConfigPath,
  CreemConfig,
} from "../lib/config";
import { resetClient } from "../lib/api";
import { detectEnvironment } from "../lib/auth";
import * as output from "../utils/output";

const VALID_KEYS: (keyof CreemConfig)[] = ["environment", "output_format"];
const VALID_VALUES: Record<string, string[]> = {
  environment: ["test", "live"],
  output_format: ["table", "json"],
};

/**
 * Displays current configuration (shared by 'show' subcommand and default action)
 */
function displayConfig(): void {
  const config = loadConfig();
  output.header("Creem CLI Configuration");
  output.newline();
  output.outputKeyValue({
    "Config file": getConfigPath(),
    Environment: config.environment,
    "Output format": config.output_format,
    "API Key": config.api_key ? "[configured]" : "[not set]",
  });
  output.newline();
}

export function createConfigCommand(): Command {
  const command = new Command("config").description(
    "View and manage CLI configuration",
  );

  // Show all config
  command
    .command("show")
    .description("Display current configuration")
    .option("--json", "Output as JSON")
    .action((options) => {
      if (options.json) {
        const config = loadConfig();
        // Don't expose full API key in JSON output
        const safeConfig = {
          ...config,
          api_key: config.api_key ? "[REDACTED]" : undefined,
        };
        output.outputJson(safeConfig);
        return;
      }

      displayConfig();
    });

  // Get a specific config value
  command
    .command("get <key>")
    .description("Get a configuration value")
    .option("--json", "Output as JSON")
    .action((key: string, options: { json?: boolean }) => {
      const config = loadConfig();

      if (key === "api_key") {
        output.warning(
          "API key cannot be displayed. Use `creem whoami` instead.",
        );
        return;
      }

      if (!VALID_KEYS.includes(key as keyof CreemConfig)) {
        output.error(`Unknown config key: ${key}`);
        output.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      const value = config[key as keyof CreemConfig];
      if (options.json) {
        output.outputJson({ [key]: value });
      } else {
        console.log(value);
      }
    });

  // Set a config value
  command
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action((key: string, value: string) => {
      if (key === "api_key") {
        output.warning("Use `creem login` to set your API key.");
        return;
      }

      if (!VALID_KEYS.includes(key as keyof CreemConfig)) {
        output.error(`Unknown config key: ${key}`);
        output.info(`Valid keys: ${VALID_KEYS.join(", ")}`);
        process.exit(1);
      }

      const validValues = VALID_VALUES[key];
      if (validValues && !validValues.includes(value)) {
        output.error(`Invalid value for ${key}: ${value}`);
        output.info(`Valid values: ${validValues.join(", ")}`);
        process.exit(1);
      }

      // Validate environment-key consistency when setting environment
      if (key === "environment") {
        const config = loadConfig();
        if (config.api_key) {
          try {
            const keyEnv = detectEnvironment(config.api_key);
            if (keyEnv !== value) {
              output.error(
                `Environment mismatch: your API key is for "${keyEnv}" but you're setting environment to "${value}".`,
              );
              output.info(
                "Run `creem login` with the correct API key for your desired environment.",
              );
              process.exit(1);
            }
          } catch {
            // Invalid key format - let them set environment, login will catch it
          }
        }
      }

      setConfigValue(
        key as keyof CreemConfig,
        value as CreemConfig[keyof CreemConfig],
      );

      // Reset client when environment changes so subsequent API calls use new endpoint
      if (key === "environment") {
        resetClient();
      }

      output.success(`Set ${key} = ${value}`);
    });

  // List available config keys
  command
    .command("list")
    .description("List available configuration keys")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const keys = [
        {
          key: "environment",
          validValues: ["test", "live"],
          description: "API environment (test or live mode)",
        },
        {
          key: "output_format",
          validValues: ["table", "json"],
          description: "Default output format",
        },
      ];

      if (options.json) {
        output.outputJson(keys);
        return;
      }

      output.header("Available Configuration Keys");
      output.newline();

      output.outputTable(
        ["Key", "Valid Values", "Description"],
        keys.map((k) => [k.key, k.validValues.join(", "), k.description]),
      );

      output.newline();
    });

  // Default action (show config) - delegates to shared displayConfig()
  command.action(() => {
    displayConfig();
    output.info('Tip: Use "creem config show --json" for JSON output');
  });

  return command;
}
