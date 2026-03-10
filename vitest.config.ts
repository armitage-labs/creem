import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    exclude: ["__integration__/**"],
    environment: "node",
  },
});
