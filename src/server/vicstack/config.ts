import type { AppConfig } from "../config";
import type { VicStackConfig } from "./types";

export function getVicStackConfig(appConfig: AppConfig): VicStackConfig {
  return {
    logsBaseUrl: appConfig.victoriaLogsUrl,
    tracesBaseUrl: appConfig.victoriaTracesUrl,
    metricsBaseUrl: appConfig.victoriaMetricsUrl,
    requestTimeoutMs: appConfig.vicStackTimeoutMs,
  };
}
