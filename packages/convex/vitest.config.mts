import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
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
