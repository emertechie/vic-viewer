import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{ts,tsx}"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src/ui"),
          },
        },
      },
    ],
  },
});
