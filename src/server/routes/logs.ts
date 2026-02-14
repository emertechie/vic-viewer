import type { FastifyInstance } from "fastify";
import type { VictoriaLogsClient } from "../vicstack/victoriaLogsClient";
import {
  logsQueryRequestSchema,
  logsQueryResponseSchema,
  type LogRow,
  type LogsCursor,
  type LogsQueryRequest,
} from "../schemas/logs";
import {
  compareLogRows,
  extractRawLogRecords,
  isAfterAnchor,
  isBeforeAnchor,
  normalizeLogRecord,
} from "../logs/normalize";
import { buildQueryHash, createCursorFromRow, decodeCursor } from "../logs/cursor";

function resolveRequestWindow(request: LogsQueryRequest, cursor: LogsCursor | null) {
  if (!cursor) {
    return {
      start: request.start,
      end: request.end,
    };
  }

  if (cursor.dir === "older") {
    return {
      start: request.start,
      end: cursor.anchor.time,
    };
  }

  return {
    start: cursor.anchor.time,
    end: request.end,
  };
}

function applyCursorFilter(rows: LogRow[], cursor: LogsCursor | null): LogRow[] {
  if (!cursor) {
    return rows;
  }

  if (cursor.dir === "older") {
    return rows.filter((row) =>
      isBeforeAnchor(row, {
        time: cursor.anchor.time,
        streamId: cursor.anchor.streamId,
        tieBreaker: cursor.anchor.tieBreaker,
      }),
    );
  }

  return rows.filter((row) =>
    isAfterAnchor(row, {
      time: cursor.anchor.time,
      streamId: cursor.anchor.streamId,
      tieBreaker: cursor.anchor.tieBreaker,
    }),
  );
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(limit, 500));
}

function assertValidCursorContext(
  cursor: LogsCursor,
  request: LogsQueryRequest,
  queryHash: string,
) {
  if (
    cursor.queryHash !== queryHash ||
    cursor.window.start !== request.start ||
    cursor.window.end !== request.end
  ) {
    throw new Error("Cursor does not match the current query context");
  }
}

export function registerLogsRoutes(
  app: FastifyInstance,
  options: { victoriaLogsClient: VictoriaLogsClient },
) {
  app.post("/api/logs/query", async (request, reply) => {
    const parsedRequest = logsQueryRequestSchema.parse(request.body);
    const normalizedRequest = {
      ...parsedRequest,
      query: parsedRequest.query.trim() || "*",
      limit: clampLimit(parsedRequest.limit),
    };

    const queryHash = buildQueryHash({
      query: normalizedRequest.query,
      start: normalizedRequest.start,
      end: normalizedRequest.end,
    });

    let cursor: LogsCursor | null = null;
    if (normalizedRequest.cursor) {
      try {
        cursor = decodeCursor(normalizedRequest.cursor);
        assertValidCursorContext(cursor, normalizedRequest, queryHash);
      } catch {
        reply.status(400).send({
          code: "INVALID_CURSOR",
          message: "Cursor is invalid for this query context",
        });
        return;
      }
    }

    const window = resolveRequestWindow(normalizedRequest, cursor);

    const rawPayload = await options.victoriaLogsClient.queryRaw({
      query: normalizedRequest.query,
      start: window.start,
      end: window.end,
      limit: normalizedRequest.limit,
    });

    const rows = applyCursorFilter(
      extractRawLogRecords(rawPayload)
        .map(normalizeLogRecord)
        .filter((row): row is LogRow => Boolean(row)),
      cursor,
    )
      .sort(compareLogRows)
      .slice(0, normalizedRequest.limit);

    const oldestRow = rows[0];
    const newestRow = rows.at(-1);
    const hasOlder = oldestRow
      ? Date.parse(oldestRow.time) > Date.parse(normalizedRequest.start)
      : false;
    const hasNewer = newestRow
      ? Date.parse(newestRow.time) < Date.parse(normalizedRequest.end)
      : false;

    const response = logsQueryResponseSchema.parse({
      rows,
      pageInfo: {
        hasOlder,
        hasNewer,
        olderCursor:
          hasOlder && oldestRow
            ? createCursorFromRow({
                direction: "older",
                row: oldestRow,
                queryHash,
                window: {
                  start: normalizedRequest.start,
                  end: normalizedRequest.end,
                },
              })
            : undefined,
        newerCursor:
          hasNewer && newestRow
            ? createCursorFromRow({
                direction: "newer",
                row: newestRow,
                queryHash,
                window: {
                  start: normalizedRequest.start,
                  end: normalizedRequest.end,
                },
              })
            : undefined,
      },
    });

    return response;
  });
}
