import * as path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase, type AppDatabase } from "./client";
import { createColumnConfigStore, type ColumnConfigStore } from "./columnConfigStore";
import { createLogsViewSettingsStore, type LogsViewSettingsStore } from "./settingsStore";

export type InitializedDatabase = {
  database: AppDatabase;
  logsViewSettingsStore: LogsViewSettingsStore;
  columnConfigStore: ColumnConfigStore;
};

export function initializeDatabase(databasePath: string): InitializedDatabase {
  const database = createDatabase(databasePath);

  migrate(database.orm, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });

  const logsViewSettingsStore = createLogsViewSettingsStore(database);
  logsViewSettingsStore.seedDefaults();

  const columnConfigStore = createColumnConfigStore(database);

  return {
    database,
    logsViewSettingsStore,
    columnConfigStore,
  };
}
