import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

/**
 * Test doubles for `creem migrate stripe`.
 *
 * `stripeFetch` serves the fixtures in `fixtures/stripe/recorded` as the Stripe
 * API would. They are the answers of a Stripe sandbox (`livemode: false`),
 * recorded through the SDK: only the `eng2012-` objects are kept, the account
 * is reduced to a fixture id and name, and object ids are kept (they are keys).
 * It refuses every non-GET request to Stripe and every read of customers,
 * subscriptions, invoices, coupons or promotion codes.
 */

const FIXTURES = join(__dirname, "fixtures", "stripe");
type Json = Record<string, any>;
type List = { object: "list"; url: string; has_more: boolean; data: Json[] };
const read = <T>(path: string): T => JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));

export const STRIPE_KEY = "rk_test_fixtureSecretKey0000000000";
export const ACCOUNT_ID = "acct_fixture0000000000";

/** Ids of the recorded sandbox objects the tests name. */
export const ID = {
  meterCalls: "mtr_test_61VplklKXH2mr8Lnh41AXmbOrRaLZJfM",
  meterUsers: "mtr_test_61VplklchLQ1Y0MTF41AXmbOrRaLZ8YC",
  meterStorage: "mtr_test_61VplklOqdvLZVdps41AXmbOrRaLZKgK",
  productPro: "prod_VhnO5VaRUVrKSX",
  productUk: "prod_VhnOCCgFb03w0W",
  productUsage: "prod_VhnOZJaHQcm3CT",
  productMeteredOnly: "prod_VhnOZYvsPma6nY",
  productTiered: "prod_VhnOkYVsWc6di8",
  productDonation: "prod_VhnOQNGsA4LW4H",
  productSeats: "prod_VhnOgTbTnMIJkG",
  productEbook: "prod_VhnOtziZP7FOgf",
  productCycles: "prod_VhnOCzIZXvoMu3",
  productLegacyUsage: "prod_VhnO7r3EbFULcn",
  productOld: "prod_VhnOKj9aLGf4sU",
  /** `lookup_key: "Pro Monthly 2024"`: not a valid Creem key. */
  priceProMonthly: "price_1UgNnQAXmbOrRaLZslqJaG2t",
  /** `lookup_key: "eng2012_pro_yearly"`. */
  priceProYearly: "price_1UgNnQAXmbOrRaLZbCbL8iLc",
  /** Inactive. */
  priceProLegacy: "price_1UgNnQAXmbOrRaLZ5nzbSvdz",
  priceUkGbp: "price_1UgNnRAXmbOrRaLZakGBazAK",
  priceUsageBase: "price_1UgNnSAXmbOrRaLZjN74EJWB",
  priceUsageMetered: "price_1UgNnSAXmbOrRaLZKBuCuSFA",
  priceMeteredOnly: "price_1UgNnSAXmbOrRaLZEue5eN3Z",
  priceTiered: "price_1UgNnTAXmbOrRaLZexTthwgh",
  priceDonation: "price_1UgNnUAXmbOrRaLZG1WZRuET",
  priceSeats: "price_1UgNnUAXmbOrRaLZHl0oCatX",
  priceEbook: "price_1UgNnVAXmbOrRaLZMZgnPmhd",
  priceWeekly: "price_1UgNnVAXmbOrRaLZxUHj4TlZ",
  priceLong: "price_1UgNnVAXmbOrRaLZrc7jUMdF",
  priceLegacyUsage: "price_1UgNnWAXmbOrRaLZqQrNW36k",
  /** Active, on the inactive product `eng2012-Old plan`. */
  priceOld: "price_1UgNnWAXmbOrRaLZoAxgfz1L",
} as const;

export function stripeDocs() {
  return {
    account: read<Json>("recorded/account.json"),
    products: read<List>("recorded/products.json"),
    prices: read<List>("recorded/prices.json"),
    meters: read<List>("recorded/meters.json"),
    webhookEndpoints: read<List>("recorded/webhook_endpoints.json"),
  };
}

const LISTS: Record<string, keyof Omit<ReturnType<typeof stripeDocs>, "account">> = {
  "/v1/products": "products",
  "/v1/prices": "prices",
  "/v1/billing/meters": "meters",
  "/v1/webhook_endpoints": "webhookEndpoints",
};

/**
 * Lists as Stripe pages them: newest first, `limit` objects, `starting_after`
 * the last id of the page before, and the filters the source sends (`active`,
 * `status`). `currency_options` is in a price only when the list expands it.
 */
export function stripeFetch(docs = stripeDocs(), options: { pageSize?: number } = {}) {
  const requests: { url: string; authorization: string | null }[] = [];
  const failing = new Map<string, { status: number; body: Json }>();
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== "api.stripe.com")
      throw new Error(`UNEXPECTED_FETCH ${request.method} ${url}`);
    if (request.method !== "GET") throw new Error(`STRIPE_WRITE_REFUSED ${request.method} ${url}`);
    requests.push({ url: url.toString(), authorization: request.headers.get("authorization") });
    if (/customers|subscriptions|invoices|coupons|promotion_codes|charges/.test(url.pathname))
      throw new Error(`UNEXPECTED_STRIPE_FETCH ${url.pathname}`);
    const failure = failing.get(url.pathname);
    if (failure) return Response.json(failure.body, { status: failure.status });
    if (url.pathname === "/v1/account") return Response.json(docs.account);
    const list = LISTS[url.pathname];
    if (!list)
      return Response.json(
        { error: { type: "invalid_request_error", message: "Unrecognized request URL" } },
        { status: 404 },
      );
    let data = docs[list].data;
    const active = url.searchParams.get("active");
    if (active !== null) data = data.filter((o) => String(o.active) === active);
    const status = url.searchParams.get("status");
    if (status !== null) data = data.filter((o) => o.status === status);
    const expand = [...url.searchParams].filter(([k]) => k.startsWith("expand")).map(([, v]) => v);
    if (list === "prices" && !expand.includes("data.currency_options"))
      data = data.map(({ currency_options: _options, ...price }) => price);
    const after = url.searchParams.get("starting_after");
    const start = after ? data.findIndex((o) => o.id === after) + 1 : 0;
    const size = options.pageSize ?? Number(url.searchParams.get("limit") ?? 10);
    const page = data.slice(start, start + size);
    return Response.json({
      object: "list",
      url: url.pathname,
      has_more: start + size < data.length,
      data: page,
    });
  });
  return {
    fetcher,
    requests,
    /** Answers every read of this path with this error. */
    fail: (path: string, status: number, body: Json) => failing.set(path, { status, body }),
  };
}
