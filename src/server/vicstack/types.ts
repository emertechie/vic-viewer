export type VicStackConfig = {
  logsBaseUrl: string;
  tracesBaseUrl: string;
  metricsBaseUrl: string;
  requestTimeoutMs: number;
};

export type UpstreamRequestOptions = {
  method?: "GET" | "POST";
  body?: BodyInit;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};
