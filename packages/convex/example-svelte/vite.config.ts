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
      "@mmailaender/creem/svelte": path.resolve(
        __dirname,
        "../src/svelte/index.ts",
      ),
      "@mmailaender/creem/react": path.resolve(
        __dirname,
        "../src/react/index.tsx",
      ),
      "@mmailaender/creem": path.resolve(__dirname, "../src/client/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@mmailaender/convex-creem/svelte"],
  },
});
