import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const logsViewSettingsTable = sqliteTable("logs_view_settings", {
  id: integer("id").primaryKey(),
  defaultLiveEnabled: integer("default_live_enabled", { mode: "boolean" }).notNull().default(false),
  rowDensity: text("row_density", { enum: ["comfortable", "compact"] })
    .notNull()
    .default("comfortable"),
  wrapLines: integer("wrap_lines", { mode: "boolean" }).notNull().default(true),
  visibleColumns: text("visible_columns", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'["time","severity","serviceName","message","traceId","spanId"]'`),
  defaultRelativeRange: text("default_relative_range", { enum: ["5m", "15m", "1h", "6h", "24h"] })
    .notNull()
    .default("15m"),
  otelPresetEnabled: integer("otel_preset_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
