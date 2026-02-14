import { eq } from "drizzle-orm";
import type { AppDatabase } from "./client";
import { logsViewSettingsTable } from "./schema";
import {
  defaultLogsViewSettings,
  logsViewSettingsSchema,
  mergeLogsViewSettings,
  type LogsViewSettings,
  type LogsViewSettingsUpdate,
} from "../schemas/settings";

const SETTINGS_SINGLETON_ID = 1;

function toSettings(row: typeof logsViewSettingsTable.$inferSelect): LogsViewSettings {
  return logsViewSettingsSchema.parse({
    defaultLiveEnabled: row.defaultLiveEnabled,
    rowDensity: row.rowDensity,
    wrapLines: row.wrapLines,
    visibleColumns: row.visibleColumns,
    defaultRelativeRange: row.defaultRelativeRange,
    otelPresetEnabled: row.otelPresetEnabled,
  });
}

export type LogsViewSettingsStore = {
  get: () => LogsViewSettings;
  put: (update: LogsViewSettingsUpdate) => LogsViewSettings;
  seedDefaults: () => LogsViewSettings;
};

export function createLogsViewSettingsStore(database: AppDatabase): LogsViewSettingsStore {
  function get(): LogsViewSettings {
    const row = database.orm
      .select()
      .from(logsViewSettingsTable)
      .where(eq(logsViewSettingsTable.id, SETTINGS_SINGLETON_ID))
      .get();

    if (!row) {
      return defaultLogsViewSettings;
    }

    return toSettings(row);
  }

  function put(update: LogsViewSettingsUpdate): LogsViewSettings {
    const nextSettings = mergeLogsViewSettings({
      ...get(),
      ...update,
    });

    const now = new Date();

    database.orm
      .insert(logsViewSettingsTable)
      .values({
        id: SETTINGS_SINGLETON_ID,
        defaultLiveEnabled: nextSettings.defaultLiveEnabled,
        rowDensity: nextSettings.rowDensity,
        wrapLines: nextSettings.wrapLines,
        visibleColumns: nextSettings.visibleColumns,
        defaultRelativeRange: nextSettings.defaultRelativeRange,
        otelPresetEnabled: nextSettings.otelPresetEnabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: logsViewSettingsTable.id,
        set: {
          defaultLiveEnabled: nextSettings.defaultLiveEnabled,
          rowDensity: nextSettings.rowDensity,
          wrapLines: nextSettings.wrapLines,
          visibleColumns: nextSettings.visibleColumns,
          defaultRelativeRange: nextSettings.defaultRelativeRange,
          otelPresetEnabled: nextSettings.otelPresetEnabled,
          updatedAt: now,
        },
      })
      .run();

    return nextSettings;
  }

  function seedDefaults() {
    return put(defaultLogsViewSettings);
  }

  return {
    get,
    put,
    seedDefaults,
  };
}
