import { z } from "zod";

/**
 * A single column entry in the user's persisted column configuration.
 * Each entry defines which field(s) to read from, a display title,
 * and optional per-column settings like width (for future resizing).
 */
export const columnConfigEntrySchema = z.object({
  /** Stable column identifier matching the profile field id (or a user-defined id for custom columns). */
  id: z.string().min(1),
  title: z.string().min(1),
  /** Primary raw field key to read from the log record. */
  field: z.string().min(1).optional(),
  /** Fallback field keys tried in order when `field` is absent or has no value. */
  fields: z.array(z.string().min(1)).min(1).optional(),
  /** Pixel width override (reserved for future column-resizing feature). */
  width: z.number().int().positive().optional(),
  /** Whether this is a user-created custom column (not from the profile). */
  custom: z.boolean().optional(),
});

export type ColumnConfigEntry = z.infer<typeof columnConfigEntrySchema>;

/**
 * The full column configuration stored per-profile.
 * `columns` lists only the *visible* columns in their display order.
 */
export const columnConfigSchema = z.object({
  columns: z.array(columnConfigEntrySchema),
});

export type ColumnConfig = z.infer<typeof columnConfigSchema>;

export const columnConfigUpdateSchema = columnConfigSchema;
export type ColumnConfigUpdate = z.infer<typeof columnConfigUpdateSchema>;
