import { Command } from "commander";
import { password } from "@inquirer/prompts";
import ora from "ora";
import { loginWithApiKey } from "../lib/auth";
import { isAuthenticated, getConfigValue } from "../lib/config";
import * as output from "../utils/output";

export function createLoginCommand(): Command {
  const command = new Command("login")
    .description("Authenticate with Creem using your API key")
    .option("--api-key <key>", "API key (or enter interactively)")
    .option("-f, --force", "Force login even if already authenticated")
    .action(async (options) => {
      let spinner: ReturnType<typeof ora> | null = null;

      try {
        // Check if already authenticated
        if (isAuthenticated() && !options.force) {
          const env = getConfigValue("environment");
          output.warning(`Already logged in (${env} mode).`);
          output.info(
            "Use --force to re-authenticate, or run `creem logout` first.",
          );
          return;
        }

        let apiKey = options.apiKey;

        // Validate that API key is not an empty string
        if (apiKey !== undefined && apiKey.trim() === "") {
          output.error("API key cannot be empty");
          process.exit(1);
        }

        // If no API key provided, prompt for it
        if (!apiKey) {
          output.newline();
          output.info("Enter your API key from the Creem dashboard.");
          output.dim(
            "Get your API key at: https://creem.io/dashboard/api-keys",
          );
          output.newline();

          apiKey = await password({
            message: "API Key:",
            mask: "*",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "API key is required";
              }
              return true;
            },
          });
        }

        // Validate and save
        spinner = ora("Validating API key...").start();

        const result = await loginWithApiKey(apiKey);

        if (result.success) {
          spinner.succeed("API key validated");
          output.newline();
          output.success("Successfully logged in to Creem!");
          output.newline();

          const env = getConfigValue("environment");
          output.info(`Environment: ${env}`);
          if (env !== "live") {
            output.dim(
              "Use `creem config set environment live` to switch to live mode.",
            );
          }
        } else {
          spinner.fail("Authentication failed");
          output.newline();
          output.error(result.message);
          process.exit(1);
        }
      } catch (error) {
        if (spinner) {
          spinner.fail("Authentication failed");
        }
        output.error(error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
      }
    });

  return command;
}
