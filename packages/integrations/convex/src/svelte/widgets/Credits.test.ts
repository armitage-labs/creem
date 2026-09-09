import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const creditsSource = readSource("./Credits.svelte");
const creditsRefreshSource = readSource("./CreditsRefresh.svelte");
const creditsAmountSource = readSource("./CreditsAmount.svelte");
const convexActionErrorSources = [
  readSource("./Credits.svelte"),
  readSource("./BillingHistory.svelte"),
  readSource("./ProductRoot.svelte"),
  readSource("./SubscriptionRoot.svelte"),
  readSource("../primitives/PaymentRecoveryButton.svelte"),
  readSource("../../react/widgets/CreditsRoot.tsx"),
  readSource("../../react/widgets/BillingHistory.tsx"),
  readSource("../../react/widgets/ProductRoot.tsx"),
  readSource("../../react/widgets/SubscriptionRoot.tsx"),
  readSource("../../react/primitives/PaymentRecoveryButton.tsx"),
  readSource("../../../example-svelte/src/App.svelte"),
  readSource("../../../example-react/src/App.tsx"),
];
const creditsCombinedSource = [
  creditsSource,
  creditsRefreshSource,
  creditsAmountSource,
].join("\n");

describe("Credits.svelte styling", () => {
  it("uses Tailwind and design-system utilities instead of component CSS", () => {
    expect(creditsCombinedSource).not.toMatch(/<style[\s>]/);
    expect(creditsCombinedSource).not.toContain("creem-credits");
    expect(creditsCombinedSource).not.toContain("consumeAmount");

    expect(creditsCombinedSource).toContain("icon-button-ghost-sm");
    expect(creditsCombinedSource).toContain("border-border-subtle");
    expect(creditsCombinedSource).toContain("text-foreground-default");
  });
});

describe("Convex action error handling", () => {
  it("reads user-facing messages from ConvexError data", () => {
    for (const source of convexActionErrorSources) {
      expect(source).toContain("getConvexErrorMessage");
      expect(source).not.toContain(
        'import { ConvexError } from "convex/values"',
      );
      expect(source).not.toContain("error instanceof ConvexError");
      expect(source).not.toContain("cause.message");
      expect(source).not.toContain("err.message");
      expect(source).not.toContain("checkoutError.message");
      expect(source).not.toMatch(/instanceof Error\s*\?/);
    }
  });
});
