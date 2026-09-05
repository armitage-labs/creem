import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createCustomersCommand(context: CliContext = createContext()) {
  return createResourceCommand("customers", context);
}
