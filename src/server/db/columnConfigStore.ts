import { eq } from "drizzle-orm";
import {
  columnConfigSchema,
  type ColumnConfig,
  type ColumnConfigUpdate,
} from "@/shared/schemas/columnConfig";
import type { AppDatabase } from "./client";
import { columnConfigsTable } from "./schema";

export type ColumnConfigStore = {
  get: (profileId: string) => ColumnConfig | null;
  put: (profileId: string, update: ColumnConfigUpdate) => ColumnConfig;
  remove: (profileId: string) => void;
};

export function createColumnConfigStore(database: AppDatabase): ColumnConfigStore {
  function get(profileId: string): ColumnConfig | null {
    const row = database.orm
      .select()
      .from(columnConfigsTable)
      .where(eq(columnConfigsTable.profileId, profileId))
      .get();

    if (!row) {
      return null;
    }

    return columnConfigSchema.parse(JSON.parse(row.config));
  }

  function put(profileId: string, update: ColumnConfigUpdate): ColumnConfig {
    const validated = columnConfigSchema.parse(update);
    const configJson = JSON.stringify(validated);
    const now = new Date();

    database.orm
      .insert(columnConfigsTable)
      .values({
        profileId,
        config: configJson,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: columnConfigsTable.profileId,
        set: {
          config: configJson,
          updatedAt: now,
        },
      })
      .run();

    return validated;
  }

  function remove(profileId: string): void {
    database.orm
      .delete(columnConfigsTable)
      .where(eq(columnConfigsTable.profileId, profileId))
      .run();
  }

  return { get, put, remove };
}
