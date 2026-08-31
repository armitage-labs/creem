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
      // More specific entries must precede the bare package alias: Vite
      // prefix-matches, so "@creem_io/convex" alone would rewrite
      // "@creem_io/convex/core" to "<client>/index.ts/core".
      "@creem_io/convex/core": path.resolve(__dirname, "../src/core/index.ts"),
      "@creem_io/convex/styles": path.resolve(__dirname, "../src/library.css"),
      "@creem_io/convex": path.resolve(__dirname, "../src/client/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@creem_io/convex/react"],
  },
});
