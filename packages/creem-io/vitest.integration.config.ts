import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__integration__/**/*.test.ts"],
    testTimeout: 30000,
    setupFiles: ["__integration__/env.ts"],
  },
});
