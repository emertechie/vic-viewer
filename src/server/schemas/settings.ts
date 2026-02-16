import { z } from "zod";
import { relativeRangeSchema } from "../../shared/schemas/settings";

export const rowDensitySchema = z.enum(["comfortable", "compact"]);
export { relativeRangeSchema };

export const logsViewSettingsSchema = z.object({
  defaultLiveEnabled: z.boolean(),
  rowDensity: rowDensitySchema,
  wrapLines: z.boolean(),
  visibleColumns: z.array(z.string()).min(1),
  defaultRelativeRange: relativeRangeSchema,
  otelPresetEnabled: z.boolean(),
});

export const logsViewSettingsUpdateSchema = logsViewSettingsSchema.partial();

export type LogsViewSettings = z.infer<typeof logsViewSettingsSchema>;
export type LogsViewSettingsUpdate = z.infer<typeof logsViewSettingsUpdateSchema>;

export const defaultLogsViewSettings: LogsViewSettings = {
  defaultLiveEnabled: false,
  rowDensity: "comfortable",
  wrapLines: true,
  visibleColumns: ["time", "severity", "serviceName", "message", "traceId", "spanId"],
  defaultRelativeRange: "15m",
  otelPresetEnabled: true,
};

export function mergeLogsViewSettings(update: LogsViewSettingsUpdate): LogsViewSettings {
  return logsViewSettingsSchema.parse({
    ...defaultLogsViewSettings,
    ...update,
  });
}
