import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { initializeDatabase, type InitializedDatabase } from "../../src/server/db/init";
import type { VictoriaLogsClient } from "../../src/server/vicstack/victoriaLogsClient";

const sampleLog = {
  _time: "2026-02-14T19:25:34.66023Z",
  _stream_id: "00000000000000007edb33edb5f802307f4bb0759c0efd35",
  _stream: '{service.name="ProcureHub.BlazorApp"}',
  _msg: "Assigned user 52eb2e5b-8fbf-4785-b305-83d9c595b473 to department ca5b4fd6-68f2-40d9-8955-14fb8ac582fb",
  "service.name": "ProcureHub.BlazorApp",
  severity: "Information",
  SpanId: "57675a26d8b5a3fb",
  TraceId: "ae301d04af9409e9d0045e81ae1eb77c",
  span_id: "57675a26d8b5a3fb",
  trace_id: "ae301d04af9409e9d0045e81ae1eb77c",
};

const defaultLogsQueryPayload = {
  query: "*",
  start: "2026-02-14T19:00:00.000Z",
  end: "2026-02-14T19:30:00.000Z",
  limit: 100,
};

type LogsQueryPayload = {
  query: string;
  start: string;
  end: string;
  limit: number;
  cursor?: string;
};

function buildLogsQueryPayload(overrides: Partial<LogsQueryPayload> = {}): LogsQueryPayload {
  return {
    ...defaultLogsQueryPayload,
    ...overrides,
  };
}

describe("logs query API", () => {
  let tempDir = "";
  let initializedDb: InitializedDatabase | null = null;
  let app: ReturnType<typeof buildApp> | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vic-viewer-logs-api-test-"));
    const databasePath = path.join(tempDir, "vic-viewer.test.db");
    initializedDb = initializeDatabase(databasePath);

    app = buildApp({
      logger: false,
      services: {
        isDatabaseReady: () => true,
        logsViewSettingsStore: initializedDb.logsViewSettingsStore,
        victoriaLogsClient: {
          queryRaw: async () => [sampleLog],
        },
      },
    });
  });

  function buildAppWithQueryRaw(queryRaw: VictoriaLogsClient["queryRaw"]) {
    return buildApp({
      logger: false,
      services: {
        isDatabaseReady: () => true,
        logsViewSettingsStore: initializedDb!.logsViewSettingsStore,
        victoriaLogsClient: {
          queryRaw,
        },
      },
    });
  }

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }

    initializedDb?.database.sqlite.close();
    initializedDb = null;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns normalized rows with directional cursors", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/logs/query",
      payload: {
        ...buildLogsQueryPayload(),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      time: "2026-02-14T19:25:34.660Z",
      raw: expect.objectContaining({
        "service.name": "ProcureHub.BlazorApp",
        severity: "Information",
        trace_id: "ae301d04af9409e9d0045e81ae1eb77c",
        span_id: "57675a26d8b5a3fb",
      }),
    });
    expect(body.rows[0]?.message).toBeUndefined();
    expect(body.pageInfo.olderCursor).toBeTruthy();
    expect(body.pageInfo.newerCursor).toBeTruthy();
  });

  it("returns validation error for invalid payload", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/logs/query",
      payload: {
        query: "",
        start: "not-a-date",
        end: "2026-02-14T19:30:00.000Z",
        limit: 1000,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns invalid cursor error when query context changes", async () => {
    const initialResponse = await app!.inject({
      method: "POST",
      url: "/api/logs/query",
      payload: {
        ...buildLogsQueryPayload(),
      },
    });

    const olderCursor = initialResponse.json().pageInfo.olderCursor;
    expect(olderCursor).toBeTruthy();

    const mismatchResponse = await app!.inject({
      method: "POST",
      url: "/api/logs/query",
      payload: buildLogsQueryPayload({
        query: "service.name:ProcureHub",
        cursor: olderCursor,
      }),
    });

    expect(mismatchResponse.statusCode).toBe(400);
    expect(mismatchResponse.json()).toMatchObject({
      code: "INVALID_CURSOR",
    });
  });

  it("pages newer rows correctly when sequence and key ordering differ", async () => {
    const sequenceApp = buildApp({
      logger: false,
      services: {
        isDatabaseReady: () => true,
        logsViewSettingsStore: initializedDb!.logsViewSettingsStore,
        victoriaLogsClient: {
          queryRaw: async () => [
            {
              _time: "2026-02-14T19:25:34.66023Z",
              _stream_id: "a-stream",
              _stream: '{service.name="svc"}',
              _msg: "SEQ:000000002 two",
              "service.name": "svc",
              severity: "INFO",
              span_id: "span-2",
              trace_id: "trace-2",
            },
            {
              _time: "2026-02-14T19:25:34.66023Z",
              _stream_id: "z-stream",
              _stream: '{service.name="svc"}',
              _msg: "SEQ:000000001 one",
              "service.name": "svc",
              severity: "INFO",
              span_id: "span-1",
              trace_id: "trace-1",
            },
          ],
        },
      },
    });

    try {
      const initialResponse = await sequenceApp.inject({
        method: "POST",
        url: "/api/logs/query",
        payload: buildLogsQueryPayload({ limit: 1 }),
      });

      expect(initialResponse.statusCode).toBe(200);
      const initialBody = initialResponse.json();
      expect(initialBody.rows).toHaveLength(1);
      expect(initialBody.rows[0]?.raw?._msg).toContain("SEQ:000000001");
      expect(initialBody.pageInfo.newerCursor).toBeTruthy();

      const newerResponse = await sequenceApp.inject({
        method: "POST",
        url: "/api/logs/query",
        payload: buildLogsQueryPayload({
          limit: 1,
          cursor: initialBody.pageInfo.newerCursor,
        }),
      });

      expect(newerResponse.statusCode).toBe(200);
      const newerBody = newerResponse.json();
      expect(newerBody.rows).toHaveLength(1);
      expect(newerBody.rows[0]?.raw?._msg).toContain("SEQ:000000002");
    } finally {
      await sequenceApp.close();
    }
  });

  it("accepts a single row object payload from VictoriaLogs", async () => {
    const singleRowPayloadApp = buildAppWithQueryRaw(async () => sampleLog);

    try {
      const response = await singleRowPayloadApp.inject({
        method: "POST",
        url: "/api/logs/query",
        payload: buildLogsQueryPayload(),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().rows).toHaveLength(1);
    } finally {
      await singleRowPayloadApp.close();
    }
  });

  it("returns an error when VictoriaLogs sends an invalid top-level payload", async () => {
    const malformedPayloadApp = buildAppWithQueryRaw(async () => "not-json-records");

    try {
      const response = await malformedPayloadApp.inject({
        method: "POST",
        url: "/api/logs/query",
        payload: buildLogsQueryPayload(),
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        code: "UPSTREAM_RESPONSE_INVALID",
      });
    } finally {
      await malformedPayloadApp.close();
    }
  });
});
