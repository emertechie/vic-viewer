import type { FastifyInstance } from "fastify";
import type { LogProfile } from "../schemas/logProfiles";
import { errorResponseSchema } from "../schemas/errors";
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

function applyCursorFilter(
  rows: LogRow[],
  cursor: LogsCursor | null,
  activeLogProfile: LogProfile,
): LogRow[] {
  if (!cursor) {
    return rows;
  }

  const anchor = cursor.anchor;

  if (cursor.dir === "older") {
    return rows.filter((row) => isBeforeAnchor(row, anchor, activeLogProfile));
  }

  return rows.filter((row) => isAfterAnchor(row, anchor, activeLogProfile));
}

function normalizeRows(
  rawRecords: Array<Record<string, unknown>>,
  activeLogProfile: LogProfile,
): LogRow[] {
  const normalizedRows: LogRow[] = [];
  for (const rawRecord of rawRecords) {
    const row = normalizeLogRecord(rawRecord, activeLogProfile);
    if (row) {
      normalizedRows.push(row);
    }
  }

  return normalizedRows;
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

function buildDirectionalCursor(options: {
  hasMoreRows: boolean;
  row: LogRow | undefined;
  direction: "older" | "newer";
  profile: LogProfile;
  queryHash: string;
  window: Pick<LogsQueryRequest, "start" | "end">;
  cursorTransportMode: CursorTransportMode;
}): string | LogsCursor | undefined {
  if (!options.hasMoreRows || !options.row) {
    return undefined;
  }

  return serializeCursor(
    buildCursorFromRow({
      direction: options.direction,
      row: options.row,
      profile: options.profile,
      queryHash: options.queryHash,
      window: options.window,
    }),
    options.cursorTransportMode,
  );
}

export function registerLogsRoutes(
  app: FastifyInstance,
  options: {
    victoriaLogsClient: VictoriaLogsClient;
    cursorTransportMode: CursorTransportMode;
    getActiveLogProfile: () => LogProfile;
  },
) {
  app.post("/api/logs/query", async (request, reply) => {
    const activeLogProfile = options.getActiveLogProfile();
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
      profile: {
        id: activeLogProfile.id,
        version: activeLogProfile.version,
      },
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
    const requestWindow = {
      start: normalizedRequest.start,
      end: normalizedRequest.end,
    };

    request.log.info(
      {
        route: "/api/logs/query",
        request: normalizedRequest,
        queryHash,
        resolvedWindow: window,
        decodedCursor: cursor,
        cursorTransportMode: options.cursorTransportMode,
        activeLogProfile: {
          id: activeLogProfile.id,
          version: activeLogProfile.version,
        },
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

      reply.status(502).send(
        errorResponseSchema.parse({
          code: "UPSTREAM_RESPONSE_INVALID",
          message: "VictoriaLogs returned an invalid logs payload",
        }),
      );
      return;
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

    const normalizedRows = normalizeRows(rawRecords, activeLogProfile);
    const filteredRows = applyCursorFilter(normalizedRows, cursor, activeLogProfile);
    const rows = [...filteredRows]
      .sort((left, right) => compareLogRows(left, right, activeLogProfile))
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
        olderCursor: buildDirectionalCursor({
          hasMoreRows: hasOlder,
          row: oldestRow,
          direction: "older",
          profile: activeLogProfile,
          queryHash,
          window: requestWindow,
          cursorTransportMode: options.cursorTransportMode,
        }),
        newerCursor: buildDirectionalCursor({
          hasMoreRows: hasNewer,
          row: newestRow,
          direction: "newer",
          profile: activeLogProfile,
          queryHash,
          window: requestWindow,
          cursorTransportMode: options.cursorTransportMode,
        }),
      },
    });

    return response;
  });
}
