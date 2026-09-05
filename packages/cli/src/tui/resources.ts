import type { CliContext } from "../lib/context";
import { launchInteractiveMode } from "./engine";
import { getProductsTuiDescriptor } from "./products";
import { getCustomersTuiDescriptor } from "./customers";
import { getSubscriptionsTuiDescriptor } from "./subscriptions";
import { getTransactionsTuiDescriptor } from "./transactions";

export async function launchResource(resource: string, context: CliContext): Promise<void> {
  switch (resource) {
    case "products":
      return launchInteractiveMode(getProductsTuiDescriptor(context));
    case "customers":
      return launchInteractiveMode(getCustomersTuiDescriptor(context));
    case "subscriptions":
      return launchInteractiveMode(getSubscriptionsTuiDescriptor(context));
    case "transactions":
      return launchInteractiveMode(getTransactionsTuiDescriptor(context));
  }
}
