import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions } from "./types.js";
import type { CreatePortalInput, CreatePortalResponse } from "./portal-types.js";

export const PortalParams = z.object({
  customerId: z.string().optional(),
  redirect: z.boolean().optional().default(false),
});

export type PortalParams = z.infer<typeof PortalParams>;

// Re-export types for convenience
export type { CreatePortalInput, CreatePortalResponse };

const createPortalHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = (ctx.body || {}) as PortalParams;

    if (!options.apiKey) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message:
          "Creem API key is not configured. Please set the apiKey option when initializing the Creem plugin.",
      });
    }

    try {
      const session = await getSessionFromCtx(ctx);

      if (!session?.user?.id) {
        throw new APIError("BAD_REQUEST", { message: "User must be logged in" });
      }

      if (!session?.user.creemCustomerId) {
        throw new APIError("BAD_REQUEST", { message: "User must have a Creem customer ID" });
      }

      logger.debug(`[creem] Portal: customer=${body.customerId || session.user.creemCustomerId}`);

      const portal = await creem.customers.generateBillingLinks({
        customerId: body.customerId || session.user.creemCustomerId,
      });

      logger.debug(`[creem] Portal created: ${portal.customerPortalLink}`);

      return ctx.json({
        url: portal.customerPortalLink,
        // No redirect by default; opt in with { redirect: true }
        redirect: !!body.redirect,
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to create portal: ${message}`);
      throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to create portal" });
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
 * // Handle navigation yourself (redirect defaults to false)
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
 *
 * // Or let better-auth redirect to the portal URL automatically
 * const { data, error } = await authClient.creem.createPortal({ redirect: true });
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
