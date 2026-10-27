import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compiles `.svelte` files for the Svelte widget render tests. Those run in
  // jsdom, which resolves through Vite's client environment; the browser
  // condition gives them Svelte's client build, where `mount` exists. Tests in
  // the edge runtime resolve through the SSR environment and are unaffected.
  plugins: [svelte()],
  resolve: { conditions: ["browser"] },
  test: {
    environment: "edge-runtime",
    exclude: ["dist/**", "node_modules/**"],
    server: { deps: { inline: ["convex-test"] } },
    onConsoleLog(log) {
      if (log.startsWith("Convex functions should not directly call")) {
        return false;
      }
    },
    coverage: {
      provider: "v8",
      include: ["src/component/**", "src/core/**", "src/client/**"],
      exclude: [
        "src/**/_generated/**",
        "src/core/index.ts",
        "src/core/types.ts",
        "src/client/polyfill.ts",
        "src/component/convex.config.ts",
        "**/*.d.ts",
      ],
    },
  },
});
