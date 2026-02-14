import type { FastifyInstance } from "fastify";
import { z } from "zod";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  services: z.object({
    api: z.literal("ready"),
    database: z.enum(["ready", "not_ready"]),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: { isDatabaseReady: () => boolean },
) {
  app.get("/api/health", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      services: {
        api: "ready",
        database: options.isDatabaseReady() ? "ready" : "not_ready",
      },
    });
  });
}
