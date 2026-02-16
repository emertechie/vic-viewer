import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { LogsViewSettingsStore } from "./db/settingsStore";
import { errorResponseSchema } from "./schemas/errors";
import type { LogProfile } from "./schemas/logProfiles";
import { registerHealthRoutes } from "./routes/health";
import { registerLogProfileRoutes } from "./routes/logProfiles";
import { registerLogsRoutes } from "./routes/logs";
import { registerSettingsRoutes } from "./routes/settings";
import { UpstreamRequestError } from "./vicstack/upstreamError";
import type { VictoriaLogsClient } from "./vicstack/victoriaLogsClient";

export type AppServices = {
  isDatabaseReady: () => boolean;
  logsViewSettingsStore: LogsViewSettingsStore;
  victoriaLogsClient: VictoriaLogsClient;
  getActiveLogProfile: () => LogProfile;
  logsCursorTransportMode: "encoded" | "json";
};

export type BuildAppOptions = {
  logger?: FastifyBaseLogger | boolean;
  services?: Partial<AppServices>;
};

const fallbackLogProfile: LogProfile = {
  id: "fallback",
  name: "Fallback",
  version: 1,
  coreFields: {
    time: { field: "_time" },
    message: { field: "_msg" },
    streamId: { field: "_stream_id" },
    stream: { field: "_stream" },
    severity: { fields: ["severity", "SeverityText"] },
    serviceName: { field: "service.name" },
    traceId: { fields: ["trace_id", "TraceId"] },
    spanId: { fields: ["span_id", "SpanId"] },
  },
  tieBreaker: {
    fields: ["_stream_id", "span_id", "SpanId", "trace_id", "TraceId", "_msg"],
  },
  logTable: {
    columns: [
      { id: "time", title: "Time", field: "_time" },
      { id: "level", title: "Level", fields: ["severity", "SeverityText"] },
      { id: "service", title: "Service", field: "service.name" },
      { id: "message", title: "Message", field: "_msg" },
      { id: "trace-id", title: "TraceId", fields: ["trace_id", "TraceId"] },
      { id: "span-id", title: "SpanId", fields: ["span_id", "SpanId"] },
    ],
  },
  logDetails: {
    fieldSets: [
      {
        id: "core",
        name: "Core",
        fields: [
          { title: "Time", field: "_time" },
          { title: "Level", fields: ["severity", "SeverityText"] },
          { title: "Service", field: "service.name" },
          { title: "Message", field: "_msg" },
        ],
      },
    ],
  },
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
  getActiveLogProfile: () => fallbackLogProfile,
  logsCursorTransportMode: "encoded",
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
    cursorTransportMode: services.logsCursorTransportMode,
    getActiveLogProfile: services.getActiveLogProfile,
  });
  registerLogProfileRoutes(app, {
    getActiveLogProfile: services.getActiveLogProfile,
  });

  return app;
}
