import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions } from "./types.js";
import type { CreatePortalInput, CreatePortalResponse } from "./portal-types.js";

export const PortalParams = z.object({
  customerId: z.string().optional(),
});

export type PortalParams = z.infer<typeof PortalParams>;

// Re-export types for convenience
export type { CreatePortalInput, CreatePortalResponse };

const createPortalHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = (ctx.body || {}) as PortalParams;

    if (!options.apiKey) {
      return ctx.json(
        {
          error:
            "Creem API key is not configured. Please set the apiKey option when initializing the Creem plugin.",
        },
        { status: 500 },
      );
    }

    try {
      const session = await getSessionFromCtx(ctx);

      if (!session?.user?.id) {
        return ctx.json({ error: "User must be logged in" }, { status: 400 });
      }

      if (!session?.user.creemCustomerId) {
        return ctx.json({ error: "User must have a Creem customer ID" }, { status: 400 });
      }

      logger.debug(`[creem] Portal: customer=${body.customerId || session.user.creemCustomerId}`);

      const portal = await creem.customers.generateBillingLinks({
        customerId: body.customerId || session.user.creemCustomerId,
      });

      logger.debug(`[creem] Portal created: ${portal.customerPortalLink}`);

      return ctx.json({
        url: portal.customerPortalLink,
        redirect: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to create portal: ${message}`);
      return ctx.json({ error: "Failed to create portal" }, { status: 500 });
    }
  };
};

/**
 * Creates the customer portal endpoint for the Creem plugin.
 *
 * This endpoint generates a Creem customer portal URL where users can
 * manage their subscriptions, view invoices, and update payment methods.
 *
 * @param creem - The Creem client instance
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint POST /creem/create-portal
 *
 * @example
 * Client-side usage:
 * ```typescript
 * // Use default customer ID from session
 * const { data, error } = await authClient.creem.createPortal();
 *
 * // Or specify a custom customer ID
 * const { data, error } = await authClient.creem.createPortal({
 *   customerId: "cust_abc123"
 * });
 *
 * if (data?.url) {
 *   window.location.href = data.url;
 * }
 * ```
 */
export const createPortalEndpoint = (creem: Creem, options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/create-portal",
    {
      method: "POST",
      body: PortalParams,
    },
    createPortalHandler(creem, options),
  );
};
