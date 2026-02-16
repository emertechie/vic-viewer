import type { FastifyInstance } from "fastify";
import { logProfileSchema, type LogProfile } from "../schemas/logProfiles";

export function registerLogProfileRoutes(
  app: FastifyInstance,
  options: { getActiveLogProfile: () => LogProfile },
) {
  app.get("/api/logs/profile", async () => {
    return logProfileSchema.parse(options.getActiveLogProfile());
  });
}
