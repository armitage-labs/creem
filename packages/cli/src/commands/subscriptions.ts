import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createSubscriptionsCommand(context: CliContext = createContext()) {
  return createResourceCommand("subscriptions", context);
}
