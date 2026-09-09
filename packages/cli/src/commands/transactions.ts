import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createTransactionsCommand(context: CliContext = createContext()) {
  return createResourceCommand("transactions", context);
}
