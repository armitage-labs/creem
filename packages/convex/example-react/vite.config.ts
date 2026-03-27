import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  envDir: "../",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@creem_io/convex/react": path.resolve(
        __dirname,
        "../src/react/index.tsx",
      ),
      "@creem_io/convex/styles": path.resolve(
        __dirname,
        "../src/library.css",
      ),
      "@creem_io/convex": path.resolve(
        __dirname,
        "../src/client/index.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@creem_io/convex/react"],
  },
});
