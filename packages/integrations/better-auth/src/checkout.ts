import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions } from "./types.js";
import { resolveSuccessUrl } from "./utils.js";
import type { CreateCheckoutInput, CreateCheckoutResponse } from "./checkout-types.js";

const CustomFieldInputSchema = z.object({
  type: z.enum(["text", "checkbox"]),
  key: z.string().max(200),
  label: z.string().max(50),
  optional: z.boolean().optional(),
  text: z.object({ maxLength: z.number().optional(), minLength: z.number().optional() }).optional(),
  checkbox: z.object({ label: z.string().optional() }).optional(),
});

export const CheckoutParams = z.object({
  productId: z.string(),
  requestId: z.string().optional(),
  units: z.number().positive().optional(),
  discountCode: z.string().optional(),
  customer: z
    .object({
      email: z.string().email().optional(),
    })
    .optional(),
  customFields: z.array(CustomFieldInputSchema).max(3).optional(),
  customField: z.array(CustomFieldInputSchema).max(3).optional(),
  successUrl: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CheckoutParams = z.infer<typeof CheckoutParams>;

// Re-export types for convenience
export type { CreateCheckoutInput, CreateCheckoutResponse };

/**
 * Check if a user has already used a trial period.
 * Used for automatic trial abuse prevention.
 *
 * @returns true if user has used a trial, false otherwise (or if check fails)
 */
async function checkUserHadTrial(
  ctx: GenericEndpointContext,
  userId: string,
  options: CreemOptions,
): Promise<boolean> {
  // Skip check if persistence is disabled
  const shouldPersist = options.persistSubscriptions !== false;
  if (!shouldPersist) {
    return false;
  }

  try {
    const user = await ctx.context.adapter.findOne<{
      id: string;
      hadTrial?: boolean;
    }>({
      model: "user",
      where: [{ field: "id", value: userId }],
    });

    return user?.hadTrial === true;
  } catch (error) {
    // If check fails, allow the checkout to proceed (fail open)
    // The trial abuse prevention is a convenience feature, not a security feature
    logger.warn(`[creem] Failed to check hadTrial status for user ${userId}`);
    return false;
  }
}

const createCheckoutHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = ctx.body as CheckoutParams;

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

      logger.debug(
        `[creem] Checkout: user=${session?.user?.id || "anonymous"}, product=${body.productId}`,
      );

      // Check if user has already used a trial (trial abuse prevention)
      let userHadTrial = false;
      if (session?.user?.id) {
        userHadTrial = await checkUserHadTrial(ctx, session.user.id, options);
        if (userHadTrial) {
          logger.info(
            `[creem] User ${session.user.id} has already used a trial - skipTrial flag will be set`,
          );
        }
      }

      const customFields = body.customFields ?? body.customField;

      const checkout = await creem.checkouts.create({
        productId: body.productId,
        requestId: body.requestId,
        units: body.units,
        discountCode: body.discountCode,
        customer: body.customer?.email
          ? {
              email: body.customer.email,
            }
          : session?.user?.email
            ? {
                email: session.user.email,
              }
            : undefined,
        customFields,
        successUrl: resolveSuccessUrl(body.successUrl || options.defaultSuccessUrl, ctx),
        metadata: {
          ...(body.metadata || {}),
          ...(session?.user?.id && {
            referenceId: session.user.id,
          }),
          // Trial abuse prevention: signal to Creem that this user has already had a trial
          // Creem will use this to skip the trial period for returning users
          ...(userHadTrial && {
            skipTrial: true,
          }),
        },
      });

      logger.debug(`[creem] Checkout created: ${checkout.checkoutUrl}`);

      return ctx.json({
        url: checkout.checkoutUrl,
        redirect: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to create checkout: ${message}`);
      return ctx.json({ error: "Failed to create checkout" }, { status: 500 });
    }
  };
};

/**
 * Creates the checkout endpoint for the Creem plugin.
 *
 * This endpoint handles creating Creem checkout sessions for authenticated users.
 * It automatically includes the user's session information and redirects to the checkout URL.
 *
 * @param creem - The Creem client instance
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint POST /creem/create-checkout
 *
 * @example
 * Client-side usage:
 * ```typescript
 * const { data, error } = await authClient.creem.createCheckout({
 *   productId: "prod_abc123",
 *   units: 1,
 *   successUrl: "/thank-you"
 * });
 *
 * if (data?.url) {
 *   window.location.href = data.url;
 * }
 * ```
 */
export const createCheckoutEndpoint = (creem: Creem, options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/create-checkout",
    {
      method: "POST",
      body: CheckoutParams,
    },
    createCheckoutHandler(creem, options),
  );
};
