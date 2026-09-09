import { createResourceCommand } from "./resource";
import { createContext, type CliContext } from "../lib/context";
export function createProductsCommand(context: CliContext = createContext()) {
  return createResourceCommand("products", context);
}
