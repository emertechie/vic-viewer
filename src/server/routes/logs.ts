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
import {
  buildCursorFromRow,
  buildQueryHash,
  parseCursorInput,
  serializeCursor,
  type CursorTransportMode,
} from "../logs/cursor";

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

function describePayloadShape(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) {
    return {
      payloadType: "array",
      payloadLength: payload.length,
    };
  }

  if (payload === null) {
    return { payloadType: "null" };
  }

  if (typeof payload === "object") {
    return {
      payloadType: "object",
      payloadKeys: Object.keys(payload as Record<string, unknown>).slice(0, 20),
    };
  }

  return {
    payloadType: typeof payload,
    payloadValue: payload,
  };
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
  options: { victoriaLogsClient: VictoriaLogsClient; cursorTransportMode: CursorTransportMode },
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
        cursor = parseCursorInput(normalizedRequest.cursor, options.cursorTransportMode);
        assertValidCursorContext(cursor, normalizedRequest, queryHash);
      } catch {
        request.log.warn(
          {
            route: "/api/logs/query",
            request: normalizedRequest,
            queryHash,
            cursorRaw: normalizedRequest.cursor,
            cursorTransportMode: options.cursorTransportMode,
          },
          "Rejected logs query request due to invalid cursor",
        );
        reply.status(400).send({
          code: "INVALID_CURSOR",
          message: "Cursor is invalid for this query context",
        });
        return;
      }
    }

    const window = resolveRequestWindow(normalizedRequest, cursor);

    request.log.info(
      {
        route: "/api/logs/query",
        request: normalizedRequest,
        queryHash,
        resolvedWindow: window,
        decodedCursor: cursor,
        cursorTransportMode: options.cursorTransportMode,
      },
      "Received logs query request",
    );

    const rawPayload = await options.victoriaLogsClient.queryRaw({
      query: normalizedRequest.query,
      start: window.start,
      end: window.end,
      limit: normalizedRequest.limit,
      cursorDirection: cursor?.dir,
    });

    const rawRecords = extractRawLogRecords(rawPayload);
    if (!Array.isArray(rawPayload)) {
      request.log.warn(
        {
          route: "/api/logs/query",
          request: normalizedRequest,
          queryHash,
          ...describePayloadShape(rawPayload),
        },
        "Logs payload could not be parsed: expected top-level array",
      );
    } else if (rawRecords.length !== rawPayload.length) {
      request.log.warn(
        {
          route: "/api/logs/query",
          request: normalizedRequest,
          queryHash,
          payloadType: "array",
          payloadLength: rawPayload.length,
          parsedRecordCount: rawRecords.length,
          droppedEntries: rawPayload.length - rawRecords.length,
        },
        "Logs payload contained non-object entries and was partially ignored",
      );
    }

    const rows = applyCursorFilter(
      rawRecords.map(normalizeLogRecord).filter((row): row is LogRow => Boolean(row)),
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
            ? serializeCursor(
                buildCursorFromRow({
                  direction: "older",
                  row: oldestRow,
                  queryHash,
                  window: {
                    start: normalizedRequest.start,
                    end: normalizedRequest.end,
                  },
                }),
                options.cursorTransportMode,
              )
            : undefined,
        newerCursor:
          hasNewer && newestRow
            ? serializeCursor(
                buildCursorFromRow({
                  direction: "newer",
                  row: newestRow,
                  queryHash,
                  window: {
                    start: normalizedRequest.start,
                    end: normalizedRequest.end,
                  },
                }),
                options.cursorTransportMode,
              )
            : undefined,
      },
    });

    return response;
  });
}
