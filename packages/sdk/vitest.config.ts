import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Type tests (*.test-d.ts) run through the type checker; tests/tsconfig.json
    // adds them to the strict project, which only covers src on its own.
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "./tests/tsconfig.json",
    },
  },
});
