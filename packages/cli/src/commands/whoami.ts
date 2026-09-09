import { Command } from "commander";
import { getAuthInfo } from "../lib/auth";
import { getBaseUrl } from "../lib/api";
import { createContext, type CliContext } from "../lib/context";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";
export function createWhoamiCommand(context: CliContext = createContext()): Command {
  const command = addGlobalOptions(
    new Command("whoami").description("Display authentication status"),
  );
  command.action(() => {
    const info = getAuthInfo();
    writeResult(
      context,
      {
        authenticated: info.authenticated,
        environment: info.environment,
        api_key_preview: info.apiKeyPreview ?? null,
        api_url: getBaseUrl(),
      },
      outputFormat(command),
    );
  });
  return command;
}
