import { Command } from "commander";
import { logout } from "../lib/auth";
import { createContext, type CliContext } from "../lib/context";
import { addGlobalOptions, outputFormat } from "./resource";
import { writeResult } from "../utils/results";
export function createLogoutCommand(context: CliContext = createContext()): Command {
  const command = addGlobalOptions(
    new Command("logout").description("Clear stored credentials (environment keys remain active)"),
  );
  command.action(() => writeResult(context, logout(), outputFormat(command)));
  return command;
}
