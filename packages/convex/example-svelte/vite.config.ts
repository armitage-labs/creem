import path from "path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: __dirname,
  envDir: "../",
  plugins: [svelte(), tailwindcss()],
  resolve: {
    conditions: ["svelte", "browser", "module", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@creem_io/convex/svelte": path.resolve(
        __dirname,
        "../src/svelte/index.ts",
      ),
      "@creem_io/convex/react": path.resolve(
        __dirname,
        "../src/react/index.tsx",
      ),
      "@creem_io/convex/styles": path.resolve(
        __dirname,
        "../src/library.css",
      ),
      "@creem_io/convex": path.resolve(__dirname, "../src/client/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@creem_io/convex/svelte"],
  },
});
