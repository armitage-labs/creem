import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
    // Type tests (*.test-d.ts) run through the type checker with tests/tsconfig.json.
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "./tests/tsconfig.json",
    },
  },
});
