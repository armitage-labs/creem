import { createRequire } from "node:module";
import type Stripe from "stripe";
import { afterEach, expect, it, vi } from "vitest";
import { harness } from "./helpers";
import { fakeCreem } from "./migrate-fixtures";
import { STRIPE_KEY } from "./migrate-stripe-fixtures";
import { fetchStripeCatalog, withoutClaudeCodeHint } from "../src/lib/migration/stripe/source";

/**
 * Stripe's own connection error says only that the connection failed, so a
 * Stripe error that quotes a key is thrown here from the read itself.
 */
vi.mock("../src/lib/migration/stripe/source", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/migration/stripe/source")>()),
  fetchStripeCatalog: vi.fn(),
}));

const { errors } = withoutClaudeCodeHint(
  () => createRequire(__filename)("stripe") as typeof Stripe,
);

afterEach(() => vi.mocked(fetchStripeCatalog).mockReset());

it("exits 5 on a Stripe connection error that quotes a key, and prints no key", async () => {
  vi.mocked(fetchStripeCatalog).mockRejectedValue(
    new errors.StripeConnectionError({
      message: `Connection to Stripe failed for rk_live_51Ab…***…1234 (${STRIPE_KEY}).`,
    }),
  );
  const creem = fakeCreem();
  const h = harness(creem.client);
  const base = ["migrate", "stripe", "--stripe-key", STRIPE_KEY, "--yes"];
  for (const r of [await h.run(["--json", ...base]), await h.run(base)]) {
    expect(r.code, r.stderr).toBe(5);
    expect(r.stderr).toContain("Connection to Stripe failed");
    expect(r.stdout + r.stderr).not.toMatch(/\b(rk|sk)_(live|test)_/);
  }
  expect(creem.writes()).toEqual([]);
});
