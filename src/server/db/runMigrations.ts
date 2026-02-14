import * as path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { loadConfig } from "../config";
import { createDatabase } from "./client";

function runMigrations() {
  const config = loadConfig();
  const database = createDatabase(config.databasePath);

  try {
    migrate(database.orm, {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
    console.log(`Migrations applied to ${config.databasePath}`);
  } finally {
    database.sqlite.close();
  }
}

runMigrations();
