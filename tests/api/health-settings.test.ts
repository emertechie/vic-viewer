import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { initializeDatabase, type InitializedDatabase } from "../../src/server/db/init";

describe("API health and settings routes", () => {
  let tempDir = "";
  let initializedDb: InitializedDatabase | null = null;
  let app: ReturnType<typeof buildApp> | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vic-viewer-api-test-"));
    const databasePath = path.join(tempDir, "vic-viewer.test.db");
    initializedDb = initializeDatabase(databasePath);

    app = buildApp({
      logger: false,
      services: {
        isDatabaseReady: () => true,
        logsViewSettingsStore: initializedDb.logsViewSettingsStore,
        victoriaLogsClient: {
          queryRaw: async () => [],
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

  it("returns readiness from /api/health", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      services: {
        api: "ready",
        database: "ready",
      },
    });
  });

  it("returns and updates logs view settings", async () => {
    const getInitialResponse = await app!.inject({
      method: "GET",
      url: "/api/settings/logs-view",
    });

    expect(getInitialResponse.statusCode).toBe(200);
    expect(getInitialResponse.json()).toMatchObject({
      defaultLiveEnabled: false,
      rowDensity: "comfortable",
      defaultRelativeRange: "15m",
    });

    const putResponse = await app!.inject({
      method: "PUT",
      url: "/api/settings/logs-view",
      payload: {
        rowDensity: "compact",
        wrapLines: false,
      },
    });

    expect(putResponse.statusCode).toBe(200);
    expect(putResponse.json()).toMatchObject({
      rowDensity: "compact",
      wrapLines: false,
    });

    const getUpdatedResponse = await app!.inject({
      method: "GET",
      url: "/api/settings/logs-view",
    });

    expect(getUpdatedResponse.statusCode).toBe(200);
    expect(getUpdatedResponse.json()).toMatchObject({
      rowDensity: "compact",
      wrapLines: false,
    });
  });
});
