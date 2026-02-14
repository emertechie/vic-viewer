import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./routes/health";

export type AppServices = {
  isDatabaseReady: () => boolean;
};

export type BuildAppOptions = {
  logger?: FastifyBaseLogger | boolean;
  services?: Partial<AppServices>;
};

const defaultServices: AppServices = {
  isDatabaseReady: () => false,
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
    request.log.error({ err: error }, "Unhandled API error");
    reply.status(500).send({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    });
  });

  void registerHealthRoutes(app, {
    isDatabaseReady: services.isDatabaseReady,
  });

  return app;
}
