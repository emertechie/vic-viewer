import { z } from "zod";

export const logRowSchema = z.object({
  key: z.string(),
  time: z.string(),
  message: z.string(),
  streamId: z.string().nullable(),
  stream: z.string().nullable(),
  severity: z.string().nullable(),
  serviceName: z.string().nullable(),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  raw: z.record(z.string(), z.unknown()),
});

export const logsCursorSchema = z.object({
  v: z.literal(1),
  dir: z.enum(["older", "newer"]),
  queryHash: z.string(),
  window: z.object({
    start: z.string(),
    end: z.string(),
  }),
  anchor: z.object({
    time: z.string(),
    streamId: z.string().nullable(),
    tieBreaker: z.string(),
  }),
});

export const logsCursorTransportSchema = z.union([z.string().min(1), logsCursorSchema]);

export const logsPageInfoSchema = z.object({
  olderCursor: logsCursorTransportSchema.optional(),
  newerCursor: logsCursorTransportSchema.optional(),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
});

export const logsQueryRequestSchema = z.object({
  query: z.string().min(1),
  start: z.string(),
  end: z.string(),
  limit: z.number().int().min(1).max(500),
  cursor: logsCursorTransportSchema.optional(),
});

export const logsQueryResponseSchema = z.object({
  rows: z.array(logRowSchema),
  pageInfo: logsPageInfoSchema,
});

export type LogRow = z.infer<typeof logRowSchema>;
export type LogsCursor = z.infer<typeof logsCursorSchema>;
export type LogsQueryRequest = z.infer<typeof logsQueryRequestSchema>;
export type LogsQueryResponse = z.infer<typeof logsQueryResponseSchema>;
export type LogsPageInfo = z.infer<typeof logsPageInfoSchema>;
