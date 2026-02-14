import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/ui"),
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: path.resolve(__dirname, "src/ui/routes"),
      generatedRouteTree: path.resolve(__dirname, "src/ui/routeTree.gen.ts"),
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/ui"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4319",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:4319",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/ui"),
    emptyOutDir: true,
  },
});
