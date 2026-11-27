import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

/**
 * Test doubles for `creem migrate paddle`: `paddleFetch` serves the fixtures in
 * `fixtures/paddle` as the Paddle Billing API would (cursor pages through
 * `meta.pagination.next`), refuses every non-GET request, and records each
 * request with its host and `Authorization` header. The Creem side is the
 * `fakeCreem` of `migrate-fixtures.ts`.
 *
 * `recorded/` comes from a Paddle sandbox (2026-11-27, objects named
 * `eng2015-*`); `hand-written/` holds what the sandbox can't: tax categories it
 * hasn't approved, an archived product, intervals outside Creem's bounds, a
 * month trial, a non-catalog price and the discount edge cases.
 */

const FIXTURES = join(__dirname, "fixtures", "paddle");
type Json = Record<string, any>;
type Page = { data: Json[]; meta: Json };
const read = (path: string): Page => JSON.parse(readFileSync(join(FIXTURES, path), "utf8"));

export const PADDLE_KEY = "pdl_sdbx_apikey_01hw_fixture_secret";
export const PADDLE_LIVE_KEY = "pdl_live_apikey_01hw_fixture_secret";

/** The Paddle lists the double serves; `handWritten: false` serves the recording only. */
export function paddleDocs(options: { handWritten?: boolean } = {}) {
  const docs: Record<"products" | "prices" | "discounts", Json[]> = {
    products: [],
    prices: [],
    discounts: [],
  };
  for (const kind of ["products", "prices", "discounts"] as const) {
    docs[kind].push(...read(`recorded/${kind}.json`).data);
    if (options.handWritten !== false) docs[kind].push(...read(`hand-written/${kind}.json`).data);
  }
  return docs;
}

export interface PaddleRequest {
  host: string;
  path: string;
  search: URLSearchParams;
  authorization: string | null;
}

export function paddleFetch(
  docs = paddleDocs(),
  options: {
    /** Items per page, to exercise the cursor. */
    pageSize?: number;
    /** Answers this status for a path, e.g. `{ "/discounts": 500 }`. */
    failures?: Record<string, number>;
    /** Replaces the `next` cursor of a page that has more, e.g. to drop it or send it elsewhere. */
    next?: (next: string, url: URL) => string | null;
    /** Throws after this many requests, so a read that never ends fails instead of hanging. */
    maxRequests?: number;
  } = {},
) {
  const requests: PaddleRequest[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== "api.paddle.com" && url.hostname !== "sandbox-api.paddle.com")
      throw new Error(`UNEXPECTED_FETCH ${request.method} ${url}`);
    if (request.method !== "GET") throw new Error(`PADDLE_WRITE_REFUSED ${request.method} ${url}`);
    if (options.maxRequests !== undefined && requests.length >= options.maxRequests)
      throw new Error(`TOO_MANY_PADDLE_REQUESTS ${url}`);
    requests.push({
      host: url.hostname,
      path: url.pathname,
      search: url.searchParams,
      authorization: request.headers.get("authorization"),
    });
    const status = options.failures?.[url.pathname];
    if (status)
      return Response.json(
        { error: { type: "api_error", code: "internal_error", detail: "Fixture failure." } },
        { status },
      );
    const kind = url.pathname.slice(1) as keyof typeof docs;
    if (!["products", "prices", "discounts"].includes(kind))
      throw new Error(`UNEXPECTED_PADDLE_FETCH ${url.pathname}`);
    const statuses = url.searchParams.getAll("status").flatMap((s) => s.split(","));
    const all = docs[kind].filter((o) => !statuses.length || statuses.includes(o.status));
    const after = url.searchParams.get("after");
    const start = after ? all.findIndex((o) => o.id === after) + 1 : 0;
    const size = options.pageSize ?? Number(url.searchParams.get("per_page") ?? 50);
    const data = all.slice(start, start + size);
    const hasMore = start + size < all.length;
    const next = new URL(url);
    if (data.length) next.searchParams.set("after", data[data.length - 1].id);
    return Response.json({
      data,
      meta: {
        request_id: "00000000-0000-0000-0000-000000000000",
        // Paddle sends `next` on the last page too; `has_more` says whether to follow it.
        pagination: {
          per_page: size,
          next: hasMore && options.next ? options.next(next.toString(), url) : next.toString(),
          has_more: hasMore,
        },
      },
    });
  });
  return { fetcher, requests };
}
