import type { FastifyInstance } from "fastify";
import { columnConfigUpdateSchema } from "@/shared/schemas/columnConfig";
import type { ColumnConfigStore } from "../db/columnConfigStore";

export function registerColumnConfigRoutes(
  app: FastifyInstance,
  options: { columnConfigStore: ColumnConfigStore },
) {
  app.get<{ Params: { profileId: string } }>(
    "/api/settings/column-config/:profileId",
    async (request) => {
      const config = options.columnConfigStore.get(request.params.profileId);
      return { config };
    },
  );

  app.put<{ Params: { profileId: string } }>(
    "/api/settings/column-config/:profileId",
    async (request) => {
      const update = columnConfigUpdateSchema.parse(request.body);
      const config = options.columnConfigStore.put(request.params.profileId, update);
      return { config };
    },
  );

  app.delete<{ Params: { profileId: string } }>(
    "/api/settings/column-config/:profileId",
    async (request) => {
      options.columnConfigStore.remove(request.params.profileId);
      return { success: true };
    },
  );
}
