import * as path from "node:path";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: path.resolve(__dirname, "src/server/db/schema.ts"),
  out: path.resolve(__dirname, "drizzle"),
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? path.resolve(__dirname, "data/vic-viewer.db"),
  },
  strict: true,
  verbose: true,
});
