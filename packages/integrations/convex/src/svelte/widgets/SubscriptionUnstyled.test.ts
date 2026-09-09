import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const librarySource = readSource("../../library.css");
const svelteRootSource = readSource("./SubscriptionRoot.svelte");
const svelteGridSource = readSource("./SubscriptionGrid.svelte");
const svelteSelectorSource = [
  readSource("./SubscriptionGroupSelector.svelte"),
  readSource("./SubscriptionIntervalSelector.svelte"),
  readSource("../primitives/SegmentGroup.svelte"),
].join("\n");
const svelteItemSlotSource = [
  readSource("./SubscriptionItemTitle.svelte"),
  readSource("./SubscriptionItemPrice.svelte"),
  readSource("./SubscriptionItemPriceCaption.svelte"),
  readSource("./SubscriptionItemDescription.svelte"),
  readSource("./SubscriptionItemBadge.svelte"),
  readSource("./SubscriptionItemCTA.svelte"),
  readSource("./SubscriptionUnitPicker.svelte"),
  readSource("./SubscriptionCancel.svelte"),
].join("\n");

const reactRootSource = readSource("../../react/widgets/SubscriptionRoot.tsx");
const reactGridSource = readSource("../../react/widgets/SubscriptionGrid.tsx");
const reactSelectorSource = [
  readSource("../../react/widgets/SubscriptionGroupSelector.tsx"),
  readSource("../../react/widgets/SubscriptionIntervalSelector.tsx"),
  readSource("../../react/primitives/SegmentGroup.tsx"),
].join("\n");
const reactItemSlotSource = readSource(
  "../../react/widgets/SubscriptionItemSlots.tsx",
);

describe("Subscription unstyled mode", () => {
  it("defines a namespaced lower-layer variant for overrideable defaults", () => {
    expect(librarySource).toContain("@custom-variant creem-base");
    expect(librarySource).toContain("@layer base");
    expect(librarySource).toContain("@slot");
  });

  it("exposes unstyled from Subscription.Root through Svelte and React context", () => {
    expect(svelteRootSource).toContain("unstyled?: boolean");
    expect(svelteRootSource).toContain("getUnstyled: () => unstyled");

    expect(reactRootSource).toContain("unstyled?: boolean");
    expect(reactRootSource).toContain("unstyled,");
  });

  it("removes built-in layout and selector classes when unstyled is enabled", () => {
    expect(svelteGridSource).toContain("rootContext?.getUnstyled()");
    expect(svelteSelectorSource).toContain(
      "unstyled ? className : `creem-base:flex creem-base:justify-center ${className}`",
    );
    expect(svelteSelectorSource).toContain(
      "unstyled ? className : `creem-base:segment-group ${className}`",
    );

    expect(reactGridSource).toContain("rootContext?.unstyled");
    expect(reactSelectorSource).toContain(
      "`creem-base:flex creem-base:justify-center ${className}`",
    );
    expect(reactSelectorSource).toContain(
      "`creem-base:segment-group ${className}`",
    );
  });

  it("lets item slot components render without default Tailwind utilities", () => {
    expect(svelteItemSlotSource).toContain("ctx.unstyled ? className");
    expect(svelteItemSlotSource).toContain(
      "ctx.unstyled ? className : `creem-base:button-filled creem-base:w-full ${className}`",
    );
    expect(svelteItemSlotSource).toContain(
      "ctx.unstyled\n      ? className\n      : `creem-base:flex",
    );
    expect(svelteItemSlotSource).toContain(
      ": `creem-base:button-outline creem-base:w-full ${className}`",
    );

    expect(reactItemSlotSource).toContain("unstyled ? className");
    expect(reactItemSlotSource).toMatch(
      /unstyled\s+\?\s+className\s+:\s+`creem-base:button-filled creem-base:w-full \$\{className\}`/,
    );
    expect(reactItemSlotSource).toContain(
      "ctx.unstyled\n    ? resolvedClassName\n    : `creem-base:flex",
    );
    expect(reactItemSlotSource).toContain(
      ": `creem-base:button-outline creem-base:w-full ${className}`",
    );
  });
});

describe("Subscription catalog plan mapping", () => {
  it("derives plans from the shared core module in both frameworks", () => {
    // Plan resolution used to be duplicated in both roots and was asserted
    // here by source text. It now lives in `core/subscriptionModel.ts` and is
    // covered behaviourally by `core/subscriptionModel.test.ts`; this only
    // guards against a root re-inlining its own copy.
    for (const source of [svelteRootSource, reactRootSource]) {
      expect(source).toContain('from "../../core/subscriptionModel.js"');
      expect(source).toContain("resolveUIPlans");
      expect(source).toContain("filterVisiblePlans");
      expect(source).not.toContain("eligibility: catalogEntry?.eligibility");
    }
  });
});
