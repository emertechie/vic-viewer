import { z } from "zod";

export const relativeRangeSchema = z.enum(["5m", "15m", "1h", "6h", "24h"]);
export const logsRangeSchema = z.union([relativeRangeSchema, z.literal("absolute")]);
const liveModeSchema = z.enum(["0", "1"]);

const logsSearchSchema = z
  .object({
    q: z.string().optional(),
    range: logsRangeSchema.optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    live: liveModeSchema.optional(),
    selected: z.string().optional(),
  })
  .passthrough();

const relativeRangeDurationsMs: Record<z.infer<typeof relativeRangeSchema>, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export type RelativeRange = z.infer<typeof relativeRangeSchema>;
export type LogsRange = z.infer<typeof logsRangeSchema>;
export type LogsSearch = {
  q: string;
  range: LogsRange;
  start: string;
  end: string;
  live: z.infer<typeof liveModeSchema>;
  selected?: string;
};

function toValidIso(value?: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function buildRelativeWindow(
  range: RelativeRange,
  now: Date,
): { start: string; end: string } {
  const end = now;
  const start = new Date(end.getTime() - relativeRangeDurationsMs[range]);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function parseLogsSearch(search: unknown, now: Date = new Date()): LogsSearch {
  const parsed = logsSearchSchema.parse(search);

  const q = parsed.q?.trim() ? parsed.q.trim() : "*";
  const range = parsed.range ?? "15m";
  const live = parsed.live ?? "0";

  const start = toValidIso(parsed.start);
  const end = toValidIso(parsed.end);

  const fallbackWindow =
    range === "absolute" ? buildRelativeWindow("15m", now) : buildRelativeWindow(range, now);

  return {
    q,
    range,
    start: start ?? fallbackWindow.start,
    end: end ?? fallbackWindow.end,
    live,
    selected: parsed.selected,
  };
}

export function refreshRelativeWindow(search: LogsSearch, now: Date): LogsSearch {
  if (search.range === "absolute") {
    return search;
  }

  const refreshed = buildRelativeWindow(search.range, now);
  return {
    ...search,
    start: refreshed.start,
    end: refreshed.end,
  };
}

export function createDefaultLogsSearch(now: Date = new Date()): LogsSearch {
  return parseLogsSearch({}, now);
}
