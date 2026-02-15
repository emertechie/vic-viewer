import type { VicStackConfig } from "./types";
import { performUpstreamRequest } from "./http";

export type VictoriaLogsClient = {
  queryRaw: (options: {
    query: string;
    start: string;
    end: string;
    limit: number;
    abortSignal?: AbortSignal;
  }) => Promise<unknown>;
};

function parseNdjsonLines(body: string): unknown[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

export function parseVictoriaLogsQueryResponse(body: string): unknown {
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return [];
  }

  try {
    return JSON.parse(trimmedBody) as unknown;
  } catch (jsonError) {
    try {
      return parseNdjsonLines(trimmedBody);
    } catch (ndjsonError) {
      throw new Error(
        `Unable to parse VictoriaLogs response as JSON or NDJSON: ${
          ndjsonError instanceof Error ? ndjsonError.message : "unknown parse error"
        }`,
      );
    }
  }
}

export function createVictoriaLogsClient(config: VicStackConfig): VictoriaLogsClient {
  return {
    async queryRaw(options) {
      const url = new URL("/select/logsql/query", config.logsBaseUrl);
      url.searchParams.set("query", options.query);
      url.searchParams.set("start", options.start);
      url.searchParams.set("end", options.end);
      url.searchParams.set("limit", String(options.limit));

      return performUpstreamRequest({
        source: "victoria-logs",
        timeoutMs: config.requestTimeoutMs,
        url: url.toString(),
        request: {
          method: "GET",
          signal: options.abortSignal,
        },
        parse: (body) => {
          return parseVictoriaLogsQueryResponse(body);
        },
      });
    },
  };
}
