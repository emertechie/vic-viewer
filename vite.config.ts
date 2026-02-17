import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const uiPort = parseInt(env.UI_PORT ?? "5173", 10);
  const apiPort = parseInt(env.API_PORT ?? "4319", 10);

  return {
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
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: uiPort,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: path.resolve(__dirname, "dist/ui"),
      emptyOutDir: true,
    },
  };
});
