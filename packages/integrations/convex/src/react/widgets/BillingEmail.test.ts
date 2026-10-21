import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Behavior is covered by `core/billingEmail.test.ts` and the render tests.
// These checks keep the React and Svelte parts in step with each other.
const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const reactRoot = readSource("./BillingEmail.tsx");
const reactParts = readSource("./BillingEmailParts.tsx");
const reactIndex = readSource("./index.ts");
const svelteDir = new URL("../../svelte/widgets/", import.meta.url);
const svelteFiles = readdirSync(fileURLToPath(svelteDir)).filter(
  (file) => file.startsWith("BillingEmail") && file.endsWith(".svelte"),
);
const svelteSources = svelteFiles.map((file) =>
  readFileSync(fileURLToPath(new URL(file, svelteDir)), "utf8"),
);
const svelteRoot = readSource("../../svelte/widgets/BillingEmail.svelte");
const svelteIndex = readSource("../../svelte/widgets/index.ts");

const PARTS = [
  "Root",
  "Title",
  "Description",
  "Label",
  "Input",
  "Save",
  "Status",
  "Error",
  "Retry",
];

const defaultClasses = (sources: string[]) =>
  new Set(sources.join("\n").match(/[\w:-]*creem-base:[\w-]+/g) ?? []);

describe("BillingEmail composition", () => {
  it("exposes the same parts in both frameworks", () => {
    for (const part of PARTS) {
      expect(reactIndex).toMatch(new RegExp(`\\b${part}: BillingEmail`));
      expect(svelteIndex).toMatch(new RegExp(`\\b${part}: BillingEmail`));
    }
  });

  it("drives both roots from the shared controller", () => {
    for (const source of [reactRoot, svelteRoot]) {
      expect(source).toContain("createBillingEmailController");
      expect(source).toContain("deriveBillingEmailView");
      expect(source).toContain("controller.setEntity(entityKey)");
    }
  });

  it("uses the same default classes in both frameworks", () => {
    expect(defaultClasses(svelteSources)).toEqual(
      defaultClasses([reactRoot, reactParts]),
    );
  });

  it("uses design-system primitives instead of component CSS", () => {
    for (const source of [reactRoot, reactParts, ...svelteSources]) {
      expect(source).not.toMatch(/<style[\s>]/);
    }
    const classes = defaultClasses([reactRoot, reactParts]);
    expect(classes).toContain("creem-base:input-default");
    expect(classes).toContain("creem-base:button-filled");
    expect(classes).toContain("creem-base:title-s");
    expect(classes).toContain("creem-base:text-left");
  });
});
