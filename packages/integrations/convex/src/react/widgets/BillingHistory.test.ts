import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const reactSource = readFileSync(
  fileURLToPath(new URL("./BillingHistory.tsx", import.meta.url)),
  "utf8",
);

const svelteSource = readFileSync(
  fileURLToPath(
    new URL("../../svelte/widgets/BillingHistory.svelte", import.meta.url),
  ),
  "utf8",
);

describe("BillingHistory pagination styling", () => {
  it("marks the current page with design-system button styles", () => {
    expect(reactSource).toContain("page.value === api.page");
    expect(svelteSource).toContain("page.value === paginationApi.page");
    expect(svelteSource).toContain(
      "<Pagination.Context render={paginationItems} />",
    );

    expect(reactSource).toContain("button-filled");
    expect(svelteSource).toContain("button-filled");
    expect(reactSource).toContain("button-faded");
    expect(svelteSource).toContain("button-faded");
  });

  it("does not use non-existent selected pagination utility classes", () => {
    for (const source of [reactSource, svelteSource]) {
      expect(source).not.toContain("bg-primary-surface-default");
      expect(source).not.toContain("text-foreground-on-primary");
    }
  });
});
