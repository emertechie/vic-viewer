import * as path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase, type AppDatabase } from "./client";
import { createLogsViewSettingsStore, type LogsViewSettingsStore } from "./settingsStore";

export type InitializedDatabase = {
  database: AppDatabase;
  logsViewSettingsStore: LogsViewSettingsStore;
};

export function initializeDatabase(databasePath: string): InitializedDatabase {
  const database = createDatabase(databasePath);

  migrate(database.orm, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });

  const logsViewSettingsStore = createLogsViewSettingsStore(database);
  logsViewSettingsStore.seedDefaults();

  return {
    database,
    logsViewSettingsStore,
  };
}
