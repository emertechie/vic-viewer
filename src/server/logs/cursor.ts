import { createHash } from "node:crypto";
import {
  logsCursorSchema,
  type LogRow,
  type LogsCursor,
  type LogsQueryRequest,
} from "../schemas/logs";
import type { LogProfile } from "../schemas/logProfiles";
import { extractLogSequenceFromRow } from "./normalize";

export type CursorQueryContext = Pick<LogsQueryRequest, "query" | "start" | "end"> & {
  profile: Pick<LogProfile, "id" | "version">;
};
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
        profile: context.profile,
        sort: "time-asc-sequence-asc-key-asc",
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
  profile: LogProfile;
  queryHash: string;
  window: { start: string; end: string };
}): LogsCursor {
  return logsCursorSchema.parse({
    v: 1,
    dir: options.direction,
    queryHash: options.queryHash,
    window: options.window,
    anchor: {
      time: options.row.time,
      streamId: options.row.streamId,
      tieBreaker: options.row.tieBreaker,
      sequence: extractLogSequenceFromRow(options.row, options.profile) ?? undefined,
    },
  });
}

export function createCursorFromRow(options: {
  direction: "older" | "newer";
  row: LogRow;
  profile: LogProfile;
  queryHash: string;
  window: { start: string; end: string };
}): string {
  return encodeCursor(buildCursorFromRow(options));
}
