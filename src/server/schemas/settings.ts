import { z } from "zod";
import { relativeRangeSchema } from "../../shared/schemas/settings";

export const rowDensitySchema = z.enum(["comfortable", "compact"]);
export { relativeRangeSchema };

export const logsViewSettingsSchema = z.object({
  defaultLiveEnabled: z.boolean(),
  rowDensity: rowDensitySchema,
  wrapLines: z.boolean(),
  defaultRelativeRange: relativeRangeSchema,
});

export const logsViewSettingsUpdateSchema = logsViewSettingsSchema.partial();

export type LogsViewSettings = z.infer<typeof logsViewSettingsSchema>;
export type LogsViewSettingsUpdate = z.infer<typeof logsViewSettingsUpdateSchema>;

export const defaultLogsViewSettings: LogsViewSettings = {
  defaultLiveEnabled: false,
  rowDensity: "comfortable",
  wrapLines: true,
  defaultRelativeRange: "15m",
};

export function mergeLogsViewSettings(update: LogsViewSettingsUpdate): LogsViewSettings {
  return logsViewSettingsSchema.parse({
    ...defaultLogsViewSettings,
    ...update,
  });
}
