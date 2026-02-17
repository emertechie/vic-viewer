import { buildApp } from "./app";
import { loadConfig } from "./config";
import { initializeDatabase } from "./db/init";
import { loadLogProfile } from "./logProfiles/loadLogProfile";
import { getVicStackConfig } from "./vicstack/config";
import { createFakeVictoriaLogsClient } from "./vicstack/fakeVictoriaLogsClient";
import { createVictoriaLogsClient } from "./vicstack/victoriaLogsClient";

async function startServer() {
  const config = loadConfig();
  let isDatabaseReady = false;
  const { database, logsViewSettingsStore, columnConfigStore } = initializeDatabase(
    config.databasePath,
  );
  isDatabaseReady = true;
  const activeLogProfile = loadLogProfile({
    profilePath: config.logsProfilePath,
    expectedProfileId: config.logsProfileId,
  });
  const victoriaLogsClient =
    config.logsDataMode === "fake"
      ? createFakeVictoriaLogsClient({
          profile: config.fakeLogsProfile,
          seed: config.fakeLogsSeed,
        })
      : createVictoriaLogsClient(getVicStackConfig(config));

  const app = buildApp({
    services: {
      isDatabaseReady: () => isDatabaseReady,
      logsViewSettingsStore,
      columnConfigStore,
      victoriaLogsClient,
      getActiveLogProfile: () => activeLogProfile,
      logsCursorTransportMode: config.logsCursorDebugRaw ? "json" : "encoded",
    },
  });

  const shutdown = async () => {
    isDatabaseReady = false;
    await app.close();
    database.sqlite.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  try {
    await app.listen({
      host: config.apiHost,
      port: config.apiPort,
    });
  } catch (error) {
    app.log.error({ err: error }, "Failed to start API server");
    isDatabaseReady = false;
    database.sqlite.close();
    process.exit(1);
  }
}

void startServer();
