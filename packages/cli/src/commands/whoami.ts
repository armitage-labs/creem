import { Command } from "commander";
import { getAuthInfo } from "../lib/auth";
import { getBaseUrl } from "../lib/api";
import { shouldOutputJson } from "../lib/config";
import * as output from "../utils/output";

export function createWhoamiCommand(): Command {
  const command = new Command("whoami")
    .description("Display current authentication status")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const authInfo = getAuthInfo();

      // JSON output for any state
      if (shouldOutputJson(options.json)) {
        output.outputJson({
          authenticated: authInfo.authenticated,
          environment: authInfo.environment,
          api_key_preview: authInfo.apiKeyPreview || null,
          api_url: getBaseUrl(),
        });
        return;
      }

      output.newline();

      if (!authInfo.authenticated) {
        output.warning("Not logged in");
        output.newline();
        output.info("Run `creem login` to authenticate.");
        return;
      }

      output.success("Logged in to Creem");
      output.newline();

      output.outputKeyValue({
        Environment: authInfo.environment,
        "API Key": authInfo.apiKeyPreview || "-",
        "API URL": getBaseUrl(),
      });

      output.newline();
    });

  return command;
}
