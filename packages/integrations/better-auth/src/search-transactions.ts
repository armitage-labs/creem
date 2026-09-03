import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { type GenericEndpointContext, logger } from "better-auth";
import { Creem } from "creem";
import { z } from "zod";
import type { CreemOptions } from "./types.js";
import type {
  SearchTransactionsInput,
  SearchTransactionsResponse,
  TransactionData,
} from "./search-transactions-types.js";

export const SearchTransactionsParams = z.object({
  customerId: z.string().optional(),
  pageNumber: z.number().min(1).optional(),
  pageSize: z.number().positive().optional(),
  productId: z.string().optional(),
  orderId: z.string().optional(),
});

export type SearchTransactionsParams = z.infer<typeof SearchTransactionsParams>;

// Re-export types for convenience
export type { SearchTransactionsInput, SearchTransactionsResponse, TransactionData };

const createSearchTransactionsHandler = (creem: Creem, options: CreemOptions) => {
  return async (ctx: GenericEndpointContext) => {
    const body = ctx.body as SearchTransactionsParams;

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

      // Use the user's Creem customer ID if no customerId is provided
      const customerId = body.customerId || session.user.creemCustomerId;

      if (!customerId) {
        return ctx.json({ error: "User must have a Creem customer ID" }, { status: 400 });
      }

      logger.debug(`[creem] Searching transactions for customer: ${customerId}`);

      const transactions = await creem.transactions.search(
        customerId,
        body.orderId,
        body.productId,
        body.pageNumber,
        body.pageSize,
      );

      return ctx.json(transactions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[creem] Failed to search transactions: ${message}`);
      return ctx.json({ error: "Failed to search transactions" }, { status: 500 });
    }
  };
};

/**
 * Creates the search transactions endpoint for the Creem plugin.
 *
 * This endpoint searches for transactions based on various filters like
 * customer ID, product ID, or order ID. Supports pagination for large result sets.
 *
 * @param creem - The Creem client instance
 * @param options - Plugin configuration options
 * @returns BetterAuth endpoint configuration
 *
 * @endpoint POST /creem/search-transactions
 *
 * @example
 * Client-side usage:
 * ```typescript
 * // Get all transactions for the current user
 * const { data, error } = await authClient.creem.searchTransactions();
 *
 * // Search with filters
 * const { data, error } = await authClient.creem.searchTransactions({
 *   customerId: "cust_abc123",
 *   productId: "prod_xyz789",
 *   pageNumber: 2,
 *   pageSize: 50
 * });
 *
 * if (data?.items) {
 *   data.items.forEach(tx => {
 *     console.log(`${tx.type}: ${tx.amount} ${tx.currency}`);
 *   });
 * }
 * ```
 */
export const createSearchTransactionsEndpoint = (creem: Creem, options: CreemOptions) => {
  return createAuthEndpoint(
    "/creem/search-transactions",
    {
      method: "POST",
      body: SearchTransactionsParams,
    },
    createSearchTransactionsHandler(creem, options),
  );
};
