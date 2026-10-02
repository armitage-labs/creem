import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Behavior is covered by `core/billingEmail.test.ts` and the render tests.
// These checks pin that both widgets share the controller and the styling.
const reactSource = readFileSync(
  fileURLToPath(new URL("./BillingEmail.tsx", import.meta.url)),
  "utf8",
);
const svelteSource = readFileSync(
  fileURLToPath(
    new URL("../../svelte/widgets/BillingEmail.svelte", import.meta.url),
  ),
  "utf8",
);
const sources = [reactSource, svelteSource];

describe("BillingEmail widgets", () => {
  it("delegate loading, saving, and validation to the shared controller", () => {
    for (const source of sources) {
      expect(source).toContain("createBillingEmailController");
      expect(source).toContain("canSaveBillingEmail(view)");
      expect(source).toContain("controller.setEntity(entityKey)");
      expect(source).toContain(
        "controller.setDraft(event.currentTarget.value)",
      );
      expect(source).toContain("controller.submit()");
    }
  });

  it("use design-system primitives instead of component CSS", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/<style[\s>]/);
      expect(source).toContain("input-default");
      expect(source).toContain("button-filled");
      expect(source).toContain("title-s text-foreground-default");
      expect(source).toContain("text-left");
    }
  });
});
