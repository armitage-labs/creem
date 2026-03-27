import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  envDir: "../",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mmailaender/convex-creem/react": path.resolve(
        __dirname,
        "../src/react/index.tsx",
      ),
      "@mmailaender/convex-creem/styles": path.resolve(
        __dirname,
        "../src/library.css",
      ),
      "@mmailaender/convex-creem": path.resolve(
        __dirname,
        "../src/client/index.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@mmailaender/convex-creem/react"],
  },
});
