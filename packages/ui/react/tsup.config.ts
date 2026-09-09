import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "@creem_io/embed"],
});
