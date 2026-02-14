import { buildApp } from "./app";
import { loadConfig } from "./config";

async function startServer() {
  const config = loadConfig();
  const app = buildApp();

  try {
    await app.listen({
      host: config.apiHost,
      port: config.apiPort,
    });
  } catch (error) {
    app.log.error({ err: error }, "Failed to start API server");
    process.exit(1);
  }
}

void startServer();
