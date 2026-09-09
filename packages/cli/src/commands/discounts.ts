import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createDiscountsCommand(context: CliContext = createContext()) {
  return createResourceCommand("discounts", context);
}
