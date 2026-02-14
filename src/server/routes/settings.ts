import type { FastifyInstance } from "fastify";
import type { LogsViewSettingsStore } from "../db/settingsStore";
import { logsViewSettingsSchema, logsViewSettingsUpdateSchema } from "../schemas/settings";

export function registerSettingsRoutes(
  app: FastifyInstance,
  options: { logsViewSettingsStore: LogsViewSettingsStore },
) {
  app.get("/api/settings/logs-view", async () => {
    return logsViewSettingsSchema.parse(options.logsViewSettingsStore.get());
  });

  app.put("/api/settings/logs-view", async (request) => {
    const update = logsViewSettingsUpdateSchema.parse(request.body);
    return logsViewSettingsSchema.parse(options.logsViewSettingsStore.put(update));
  });
}
