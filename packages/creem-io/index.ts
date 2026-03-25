import { productsResource } from "./resources/products";
import { checkoutsResource } from "./resources/checkouts";
import { customersResource } from "./resources/customers";
import { subscriptionsResource } from "./resources/subscriptions";
import { transactionsResource } from "./resources/transactions";
import { licensesResource } from "./resources/licenses";
import { discountsResource } from "./resources/discounts";
import { webhooksResource } from "./resources/webhooks";
import { statsResource } from "./resources/stats";
import { createRequest } from "./request";

/**
 * @deprecated This package is deprecated. Please use the `creem` package instead: `npm install creem`
 */
interface CreemOptions {
  apiKey: string;
  webhookSecret?: string;
  testMode?: boolean;
}

/**
 * @deprecated This package is deprecated. Please use the `creem` package instead: `npm install creem`
 */
export function createCreem({ apiKey, webhookSecret, testMode = false }: CreemOptions) {
  console.warn(
    "[creem_io] This package is deprecated. Please migrate to the official 'creem' package: npm install creem",
  );

  const baseUrl = testMode ? "https://test-api.creem.io" : "https://api.creem.io";

  const request = createRequest(apiKey, baseUrl);

  return {
    products: productsResource(request),
    checkouts: checkoutsResource(request),
    customers: customersResource(request),
    subscriptions: subscriptionsResource(request),
    transactions: transactionsResource(request),
    licenses: licensesResource(request),
    discounts: discountsResource(request),
    webhooks: webhooksResource(webhookSecret),
    stats: statsResource(request),
  };
}

export * from "./types";
