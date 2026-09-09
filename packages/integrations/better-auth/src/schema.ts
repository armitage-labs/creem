import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { mergeSchema } from "better-auth/db";
import { CreemOptions } from "./types.js";

export const subscriptions = {
  creem_subscription: {
    fields: {
      productId: {
        type: "string",
        required: true,
      },
      referenceId: {
        type: "string",
        required: true,
      },
      creemCustomerId: {
        type: "string",
        required: false,
      },
      creemSubscriptionId: {
        type: "string",
        required: false,
      },
      creemOrderId: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        defaultValue: "pending",
      },
      periodStart: {
        type: "date",
        required: false,
      },
      periodEnd: {
        type: "date",
        required: false,
      },
      cancelAtPeriodEnd: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const user = {
  user: {
    fields: {
      creemCustomerId: {
        type: "string",
        required: false,
      },
      /**
       * Tracks whether this user has ever used a trial period.
       * Used for automatic trial abuse prevention - users can only
       * receive one trial across all subscription plans.
       *
       * This field is:
       * - Optional (required: false) for backward compatibility with existing users
       * - Defaults to false for new users
       * - Set to true when user enters a trialing subscription state
       *
       * @since 1.1.0
       */
      hadTrial: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const getSchema = (options: CreemOptions) => {
  // Default persistSubscriptions to true if not specified
  const shouldPersist = options.persistSubscriptions !== false;

  // Only include schema if persistSubscriptions is enabled
  const baseSchema = shouldPersist
    ? {
        ...subscriptions,
        ...user,
      }
    : {};

  return mergeSchema(baseSchema, options.schema);
};
