import * as path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4319),
  DATABASE_PATH: z.string().default(path.resolve(process.cwd(), "data/vic-viewer.db")),
  VICTORIA_LOGS_URL: z.string().url().default("http://localhost:9428"),
  VICTORIA_TRACES_URL: z.string().url().default("http://localhost:10428"),
  VICTORIA_METRICS_URL: z.string().url().default("http://localhost:8428"),
  VICSTACK_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LOGS_DATA_MODE: z.enum(["vicstack", "fake"]).default("vicstack"),
  FAKE_LOGS_PROFILE: z.enum(["steady", "bursty", "noisy"]).default("steady"),
  FAKE_LOGS_SEED: z.string().default("vic-viewer-fake-seed"),
  LOGS_CURSOR_DEBUG_RAW: z
    .string()
    .optional()
    .transform((value) => (value ?? "0").toLowerCase())
    .pipe(z.enum(["0", "1", "false", "true", "no", "yes"]))
    .transform((value) => value === "1" || value === "true" || value === "yes"),
});

export type AppConfig = {
  apiHost: string;
  apiPort: number;
  databasePath: string;
  victoriaLogsUrl: string;
  victoriaTracesUrl: string;
  victoriaMetricsUrl: string;
  vicStackTimeoutMs: number;
  logsDataMode: "vicstack" | "fake";
  fakeLogsProfile: "steady" | "bursty" | "noisy";
  fakeLogsSeed: string;
  logsCursorDebugRaw: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    apiHost: parsed.API_HOST,
    apiPort: parsed.API_PORT,
    databasePath: parsed.DATABASE_PATH,
    victoriaLogsUrl: parsed.VICTORIA_LOGS_URL,
    victoriaTracesUrl: parsed.VICTORIA_TRACES_URL,
    victoriaMetricsUrl: parsed.VICTORIA_METRICS_URL,
    vicStackTimeoutMs: parsed.VICSTACK_TIMEOUT_MS,
    logsDataMode: parsed.LOGS_DATA_MODE,
    fakeLogsProfile: parsed.FAKE_LOGS_PROFILE,
    fakeLogsSeed: parsed.FAKE_LOGS_SEED,
    logsCursorDebugRaw: parsed.LOGS_CURSOR_DEBUG_RAW,
  };
}
