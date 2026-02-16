import { createHash } from "node:crypto";
import {
  logsCursorSchema,
  type LogRow,
  type LogsCursor,
  type LogsQueryRequest,
} from "../schemas/logs";

export type CursorQueryContext = Pick<LogsQueryRequest, "query" | "start" | "end">;
export type CursorTransportMode = "encoded" | "json";

export function buildQueryHash(context: CursorQueryContext): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        query: context.query,
        window: {
          start: context.start,
          end: context.end,
        },
        sort: "time-asc-key-asc",
      }),
    )
    .digest("hex");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeCursor(cursor: LogsCursor): string {
  return toBase64Url(JSON.stringify(logsCursorSchema.parse(cursor)));
}

export function decodeCursor(encodedCursor: string): LogsCursor {
  const decoded = fromBase64Url(encodedCursor);
  return logsCursorSchema.parse(JSON.parse(decoded) as unknown);
}

export function parseCursorInput(
  cursorInput: string | LogsCursor,
  mode: CursorTransportMode,
): LogsCursor {
  if (mode === "json") {
    return logsCursorSchema.parse(cursorInput);
  }

  if (typeof cursorInput !== "string") {
    throw new Error("Cursor must be an encoded string");
  }

  return decodeCursor(cursorInput);
}

export function serializeCursor(
  cursor: LogsCursor,
  mode: CursorTransportMode,
): string | LogsCursor {
  const parsedCursor = logsCursorSchema.parse(cursor);
  return mode === "json" ? parsedCursor : encodeCursor(parsedCursor);
}

export function buildCursorFromRow(options: {
  direction: "older" | "newer";
  row: LogRow;
  queryHash: string;
  window: { start: string; end: string };
}): LogsCursor {
  const keyParts = options.row.key.split(":");
  const tieBreaker = keyParts[keyParts.length - 1] ?? "";

  return logsCursorSchema.parse({
    v: 1,
    dir: options.direction,
    queryHash: options.queryHash,
    window: options.window,
    anchor: {
      time: options.row.time,
      streamId: options.row.streamId,
      tieBreaker,
    },
  });
}

export function createCursorFromRow(options: {
  direction: "older" | "newer";
  row: LogRow;
  queryHash: string;
  window: { start: string; end: string };
}): string {
  return encodeCursor(buildCursorFromRow(options));
}
