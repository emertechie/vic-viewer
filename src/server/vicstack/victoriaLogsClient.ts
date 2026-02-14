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
          if (!body) {
            return [];
          }

          return JSON.parse(body) as unknown;
        },
      });
    },
  };
}
