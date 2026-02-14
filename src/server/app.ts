import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { LogsViewSettingsStore } from "./db/settingsStore";
import { errorResponseSchema } from "./schemas/errors";
import { registerHealthRoutes } from "./routes/health";
import { registerLogsRoutes } from "./routes/logs";
import { registerSettingsRoutes } from "./routes/settings";
import { UpstreamRequestError } from "./vicstack/upstreamError";
import type { VictoriaLogsClient } from "./vicstack/victoriaLogsClient";

export type AppServices = {
  isDatabaseReady: () => boolean;
  logsViewSettingsStore: LogsViewSettingsStore;
  victoriaLogsClient: VictoriaLogsClient;
};

export type BuildAppOptions = {
  logger?: FastifyBaseLogger | boolean;
  services?: Partial<AppServices>;
};

const defaultServices: AppServices = {
  isDatabaseReady: () => false,
  logsViewSettingsStore: {
    get: () => {
      throw new Error("Logs view settings store not configured");
    },
    put: () => {
      throw new Error("Logs view settings store not configured");
    },
    seedDefaults: () => {
      throw new Error("Logs view settings store not configured");
    },
  },
  victoriaLogsClient: {
    queryRaw: async () => {
      throw new Error("VictoriaLogs client not configured");
    },
  },
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
  });

  const services: AppServices = {
    ...defaultServices,
    ...options.services,
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send(
        errorResponseSchema.parse({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        }),
      );
      return;
    }

    if (error instanceof UpstreamRequestError) {
      reply.status(error.statusCode).send(
        errorResponseSchema.parse({
          code: "UPSTREAM_REQUEST_FAILED",
          message: error.message,
          details: {
            source: error.source,
            statusCode: error.statusCode,
          },
        }),
      );
      return;
    }

    request.log.error({ err: error }, "Unhandled API error");
    reply.status(500).send(
      errorResponseSchema.parse({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      }),
    );
  });

  registerHealthRoutes(app, {
    isDatabaseReady: services.isDatabaseReady,
  });
  registerSettingsRoutes(app, {
    logsViewSettingsStore: services.logsViewSettingsStore,
  });
  registerLogsRoutes(app, {
    victoriaLogsClient: services.victoriaLogsClient,
  });

  return app;
}
