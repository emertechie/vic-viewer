import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const logsCursorDirectionSchema = z.enum(["older", "newer"]);

export const logsCursorSchema = z.object({
  v: z.literal(1),
  dir: logsCursorDirectionSchema,
  queryHash: z.string().length(64),
  window: z.object({
    start: isoDateTimeSchema,
    end: isoDateTimeSchema,
  }),
  anchor: z.object({
    time: isoDateTimeSchema,
    streamId: z.string().nullable(),
    tieBreaker: z.string(),
    sequence: z.number().int().positive().optional(),
  }),
});

export const logsCursorTransportSchema = z.union([z.string().min(1), logsCursorSchema]);

export const logsQueryRequestSchema = z.object({
  query: z.string().min(1),
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
  limit: z.number().int().min(1).max(500).default(200),
  cursor: logsCursorTransportSchema.optional(),
});

export const logRowSchema = z.object({
  key: z.string().min(1),
  time: isoDateTimeSchema,
  tieBreaker: z.string().min(1),
  message: z.string(),
  streamId: z.string().nullable(),
  stream: z.string().nullable(),
  severity: z.string().nullable(),
  serviceName: z.string().nullable(),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  raw: z.record(z.string(), z.unknown()),
});

export const logsPageInfoSchema = z.object({
  olderCursor: logsCursorTransportSchema.optional(),
  newerCursor: logsCursorTransportSchema.optional(),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
});

export const logsQueryResponseSchema = z.object({
  rows: z.array(logRowSchema),
  pageInfo: logsPageInfoSchema,
});

export type LogsQueryRequest = z.infer<typeof logsQueryRequestSchema>;
export type LogRow = z.infer<typeof logRowSchema>;
export type LogsQueryResponse = z.infer<typeof logsQueryResponseSchema>;
export type LogsCursor = z.infer<typeof logsCursorSchema>;
