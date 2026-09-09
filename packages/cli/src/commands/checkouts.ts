import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createCheckoutsCommand(context: CliContext = createContext()) {
  return createResourceCommand("checkouts", context);
}
