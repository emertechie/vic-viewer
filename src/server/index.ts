import { buildApp } from "./app";
import { loadConfig } from "./config";
import { initializeDatabase } from "./db/init";

async function startServer() {
  const config = loadConfig();
  let isDatabaseReady = false;
  const { database, logsViewSettingsStore } = initializeDatabase(config.databasePath);
  isDatabaseReady = true;

  const app = buildApp({
    services: {
      isDatabaseReady: () => isDatabaseReady,
      logsViewSettingsStore,
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
