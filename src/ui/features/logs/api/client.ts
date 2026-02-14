import { logsQueryResponseSchema, type LogsQueryRequest, type LogsQueryResponse } from "./types";

type ApiError = {
  code?: string;
  message?: string;
};

export async function fetchLogsQuery(request: LogsQueryRequest): Promise<LogsQueryResponse> {
  const response = await fetch("/api/logs/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let apiError: ApiError = {};
    try {
      apiError = (await response.json()) as ApiError;
    } catch {
      // no-op: fallback error below
    }

    throw new Error(apiError.message ?? "Failed to query logs");
  }

  return logsQueryResponseSchema.parse(await response.json());
}
