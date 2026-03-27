import { httpRouter } from "convex/server";
import { creem } from "./billing";

const http = httpRouter();

creem.registerRoutes(http, {
  // Optional custom path, default is "/creem/events"
  path: "/creem/events",
  // Typesafe event handlers for any Creem webhook event.
  // The component automatically stores subscriptions and orders from webhooks.
  // Add custom handlers here for app-specific logic (e.g. sending emails, logging).
  events: {
    "subscription.updated": async (_ctx, event) => {
      console.log("Subscription updated", event);
      const data = (event.data ?? event.object) as
        | {
            customerCancellationReason?: string;
            customerCancellationComment?: string;
          }
        | undefined;
      if (data?.customerCancellationReason) {
        console.log(
          "Customer cancellation reason",
          data.customerCancellationReason,
        );
        console.log(
          "Customer cancellation comment",
          data.customerCancellationComment,
        );
      }
    },
    "checkout.completed": async (_ctx, event) => {
      console.log("Checkout completed", event);
    },
  },
});

export default http;
