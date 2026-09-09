import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    "create-creem-auth-client": "src/create-creem-auth-client.ts",
    "creem-server": "src/creem-server.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["better-auth", "@better-auth/core", "better-call", "creem", "zod"],
});
