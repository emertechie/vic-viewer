import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { initializeDatabase, type InitializedDatabase } from "../../src/server/db/init";

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
        query: "*",
        start: "2026-02-14T19:00:00.000Z",
        end: "2026-02-14T19:30:00.000Z",
        limit: 100,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      time: "2026-02-14T19:25:34.660Z",
      serviceName: "ProcureHub.BlazorApp",
      severity: "Information",
      traceId: "ae301d04af9409e9d0045e81ae1eb77c",
      spanId: "57675a26d8b5a3fb",
    });
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
        query: "*",
        start: "2026-02-14T19:00:00.000Z",
        end: "2026-02-14T19:30:00.000Z",
        limit: 100,
      },
    });

    const olderCursor = initialResponse.json().pageInfo.olderCursor;
    expect(olderCursor).toBeTruthy();

    const mismatchResponse = await app!.inject({
      method: "POST",
      url: "/api/logs/query",
      payload: {
        query: "service.name:ProcureHub",
        start: "2026-02-14T19:00:00.000Z",
        end: "2026-02-14T19:30:00.000Z",
        limit: 100,
        cursor: olderCursor,
      },
    });

    expect(mismatchResponse.statusCode).toBe(400);
    expect(mismatchResponse.json()).toMatchObject({
      code: "INVALID_CURSOR",
    });
  });
});
