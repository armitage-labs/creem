import { defineConfig } from "vitest/config";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvFile(filename: string): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), filename), "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

export default defineConfig({
  test: {
    include: ["src/__integration__/**/*.test.ts"],
    environment: "node",
    env: loadEnvFile(".env.test"),
    testTimeout: 30000,
  },
});
