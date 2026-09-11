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

/** Physical model/column names; these do not change the inferred field types. */
export type CreemSchemaOverrides = Parameters<
  typeof mergeSchema<typeof user & typeof subscriptions>
>[1];

// Better Auth's inference can discard an empty member of a schema union. If persistence
// might be disabled at runtime, do not promise any Creem fields to the client.
type GetSchemaResult<T extends CreemOptions> = "persistSubscriptions" extends keyof T
  ? false extends T["persistSubscriptions"]
    ? {}
    : typeof user & typeof subscriptions
  : typeof user & typeof subscriptions;

export const getSchema = <T extends CreemOptions>(options: T): GetSchemaResult<T> => {
  if (options.persistSubscriptions === false) {
    return {} as GetSchemaResult<T>;
  }

  // mergeSchema mutates its input. Keep model/column overrides local to this plugin instance.
  return mergeSchema(
    structuredClone({ ...subscriptions, ...user }),
    options.schema,
  ) as GetSchemaResult<T>;
};
