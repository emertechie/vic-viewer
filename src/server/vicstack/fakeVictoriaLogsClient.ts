import { createHash } from "node:crypto";
import type { VictoriaLogsClient } from "./victoriaLogsClient";

const SEVERITIES = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const;
const SERVICES = ["api", "worker", "scheduler", "frontend", "billing", "search"] as const;
const TIMELINE_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

type FakeLogsProfile = "steady" | "bursty" | "noisy";

type FakeLogRecord = {
  sequence: number;
  timestampMs: number;
  raw: Record<string, unknown>;
};

function toMillis(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hashToUnitInterval(seed: string): number {
  const hash = createHash("sha1").update(seed).digest("hex");
  const firstWord = hash.slice(0, 8);
  const value = Number.parseInt(firstWord, 16);
  return value / 0xffffffff;
}

function pickFromList<T>(items: readonly T[], seed: string): T {
  const index = Math.floor(hashToUnitInterval(seed) * items.length);
  return items[Math.min(index, items.length - 1)] ?? items[0];
}

function resolveCadenceMs(ageMs: number, profile: FakeLogsProfile): number {
  if (ageMs <= 60 * 60 * 1000) {
    if (profile === "steady") {
      return 5_000;
    }

    if (profile === "bursty") {
      return 3_000;
    }

    return 2_000;
  }

  if (ageMs <= 24 * 60 * 60 * 1000) {
    if (profile === "steady") {
      return 60_000;
    }

    if (profile === "bursty") {
      return 30_000;
    }

    return 20_000;
  }

  if (profile === "steady") {
    return 15 * 60 * 1000;
  }

  if (profile === "bursty") {
    return 10 * 60 * 1000;
  }

  return 5 * 60 * 1000;
}

function resolveRecordsPerTick(profile: FakeLogsProfile, seed: string): number {
  const random = hashToUnitInterval(seed);

  if (profile === "steady") {
    return random < 0.08 ? 2 : 1;
  }

  if (profile === "bursty") {
    if (random < 0.15) {
      return 3;
    }

    return random < 0.4 ? 2 : 1;
  }

  if (random < 0.1) {
    return 4;
  }

  return random < 0.45 ? 2 : 1;
}

function buildMessage(options: {
  sequence: number;
  service: string;
  severity: string;
  profile: FakeLogsProfile;
  checkpointEvery: number;
}): string {
  const sequenceText = String(options.sequence).padStart(9, "0");
  const checkpointText =
    options.sequence % options.checkpointEvery === 0
      ? ` | CHECKPOINT:${Math.floor(options.sequence / options.checkpointEvery)}`
      : "";

  return `SEQ:${sequenceText}${checkpointText} | svc=${options.service} | level=${options.severity} | profile=${options.profile}`;
}

function buildStream(service: string, severity: string): string {
  return `{service.name="${service}",severity="${severity}"}`;
}

function queryMatches(record: FakeLogRecord, query: string): boolean {
  const normalized = query.trim();
  if (normalized.length === 0 || normalized === "*") {
    return true;
  }

  const serviceMatch = normalized.match(/service\.name:([^\s]+)/i);
  if (serviceMatch) {
    const service = String(record.raw["service.name"] ?? "").toLowerCase();
    if (service !== serviceMatch[1].toLowerCase()) {
      return false;
    }
  }

  const severityMatch = normalized.match(/severity:([^\s]+)/i);
  if (severityMatch) {
    const severity = String(record.raw["severity"] ?? "").toLowerCase();
    if (severity !== severityMatch[1].toLowerCase()) {
      return false;
    }
  }

  const searchableText = String(record.raw["_msg"] ?? "").toLowerCase();
  const freeText = normalized
    .replace(/service\.name:[^\s]+/gi, " ")
    .replace(/severity:[^\s]+/gi, " ")
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && part !== "and" && part !== "or");

  return freeText.every((token) => searchableText.includes(token));
}

function generateRecords(options: {
  query: string;
  startMs: number;
  endMs: number;
  referenceNowMs: number;
  timelineStartMs: number;
  profile: FakeLogsProfile;
  seed: string;
}): FakeLogRecord[] {
  if (options.endMs <= options.startMs) {
    return [];
  }

  const records: FakeLogRecord[] = [];
  let sequence = 0;
  let tickMs = options.timelineStartMs;

  while (tickMs <= options.endMs) {
    const ageMs = Math.max(0, options.referenceNowMs - tickMs);
    const cadenceMs = resolveCadenceMs(ageMs, options.profile);
    const count = resolveRecordsPerTick(options.profile, `${options.seed}:count:${tickMs}`);

    for (let index = 0; index < count; index += 1) {
      sequence += 1;

      const streamSeed = `${options.seed}:stream:${tickMs}:${index}`;
      const service = pickFromList(SERVICES, `${streamSeed}:service`);
      const severity = pickFromList(SEVERITIES, `${streamSeed}:severity`);
      const streamId = `stream-${service}-${Math.floor(hashToUnitInterval(`${streamSeed}:id`) * 20)}`;
      const timestampJitterMs =
        options.profile === "noisy"
          ? Math.floor(hashToUnitInterval(`${streamSeed}:jitter`) * 400) - 200
          : 0;
      const timestampMs = tickMs + timestampJitterMs;
      const traceId = createHash("sha1").update(`${streamSeed}:trace`).digest("hex").slice(0, 32);
      const spanId = createHash("sha1").update(`${streamSeed}:span`).digest("hex").slice(0, 16);
      const message = buildMessage({
        sequence,
        service,
        severity,
        profile: options.profile,
        checkpointEvery: 250,
      });

      const record: FakeLogRecord = {
        sequence,
        timestampMs,
        raw: {
          _time: new Date(timestampMs).toISOString(),
          _msg: message,
          _stream_id: streamId,
          _stream: buildStream(service, severity),
          severity,
          "service.name": service,
          trace_id: traceId,
          span_id: spanId,
        },
      };

      if (
        record.timestampMs >= options.startMs &&
        record.timestampMs <= options.endMs &&
        queryMatches(record, options.query)
      ) {
        records.push(record);
      }
    }

    tickMs += cadenceMs;
  }

  return records;
}

export function createFakeVictoriaLogsClient(options: {
  profile: FakeLogsProfile;
  seed: string;
}): VictoriaLogsClient {
  const referenceNowMs = Date.now();
  const timelineStartMs = referenceNowMs - TIMELINE_LOOKBACK_MS;

  return {
    async queryRaw(request) {
      const startMs = toMillis(request.start);
      const endMs = toMillis(request.end);
      if (startMs === null || endMs === null) {
        return [];
      }

      const sortedRecords = generateRecords({
        query: request.query,
        startMs,
        endMs,
        referenceNowMs,
        timelineStartMs,
        profile: options.profile,
        seed: options.seed,
      }).sort((left, right) => {
        if (left.timestampMs !== right.timestampMs) {
          return right.timestampMs - left.timestampMs;
        }

        return right.sequence - left.sequence;
      });

      const rows = (() => {
        if (sortedRecords.length <= request.limit) {
          return sortedRecords;
        }

        if (request.cursorDirection === "older") {
          return sortedRecords.slice(0, request.limit);
        }

        if (request.cursorDirection === "newer") {
          return sortedRecords.slice(sortedRecords.length - request.limit);
        }

        const historicalWindow = endMs < referenceNowMs - 60_000;
        if (historicalWindow) {
          const middleStart = Math.floor((sortedRecords.length - request.limit) / 2);
          return sortedRecords.slice(middleStart, middleStart + request.limit);
        }

        return sortedRecords.slice(0, request.limit);
      })().map((record) => record.raw);

      return rows;
    },
  };
}
