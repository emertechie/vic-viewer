import { logsQueryResponseSchema, type LogsQueryRequest, type LogsQueryResponse } from "./types";
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
