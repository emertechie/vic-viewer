import {
  columnConfigSchema,
  logProfileSchema,
  logsQueryResponseSchema,
  type ColumnConfig,
  type ColumnConfigUpdate,
  type LogProfile,
  type LogsQueryRequest,
  type LogsQueryResponse,
} from "./types";
import { errorResponseSchema } from "../../../../shared/schemas/errors";

export async function fetchLogsQuery(request: LogsQueryRequest): Promise<LogsQueryResponse> {
  const response = await fetch("/api/logs/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let apiErrorMessage = "Failed to query logs";
    try {
      const apiError = errorResponseSchema.safeParse(await response.json());
      if (apiError.success) {
        apiErrorMessage = apiError.data.message;
      }
    } catch {
      // no-op: fallback error below
    }

    throw new Error(apiErrorMessage);
  }

  return logsQueryResponseSchema.parse(await response.json());
}

export async function fetchActiveLogProfile(): Promise<LogProfile> {
  const response = await fetch("/api/logs/profile");
  if (!response.ok) {
    throw new Error("Failed to load active log profile");
  }

  return logProfileSchema.parse(await response.json());
}

export async function fetchColumnConfig(profileId: string): Promise<ColumnConfig | null> {
  const response = await fetch(`/api/settings/column-config/${encodeURIComponent(profileId)}`);
  if (!response.ok) {
    throw new Error("Failed to load column config");
  }

  const body = (await response.json()) as { config: unknown };
  if (!body.config) {
    return null;
  }

  return columnConfigSchema.parse(body.config);
}

export async function putColumnConfig(
  profileId: string,
  update: ColumnConfigUpdate,
): Promise<ColumnConfig> {
  const response = await fetch(`/api/settings/column-config/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error("Failed to save column config");
  }

  const body = (await response.json()) as { config: unknown };
  return columnConfigSchema.parse(body.config);
}

export async function deleteColumnConfig(profileId: string): Promise<void> {
  const response = await fetch(`/api/settings/column-config/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete column config");
  }
}
