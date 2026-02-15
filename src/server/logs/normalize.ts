import { createHash } from "node:crypto";
import { logRowSchema, type LogRow } from "../schemas/logs";

type RawLogRecord = Record<string, unknown>;

function getNullableString(record: RawLogRecord, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function buildTieBreaker(record: {
  streamId: string | null;
  spanId: string | null;
  traceId: string | null;
  message: string;
}) {
  const tieSource = `${record.streamId ?? ""}:${record.spanId ?? ""}:${record.traceId ?? ""}:${record.message}`;
  return createHash("sha1").update(tieSource).digest("hex");
}

export function normalizeLogRecord(record: RawLogRecord): LogRow | null {
  const time = toIsoDate(record["_time"]);
  if (!time) {
    return null;
  }

  const message = getNullableString(record, "_msg") ?? "";
  const streamId = getNullableString(record, "_stream_id");
  const stream = getNullableString(record, "_stream");
  const severity =
    getNullableString(record, "severity") ?? getNullableString(record, "SeverityText");
  const serviceName = getNullableString(record, "service.name");
  const traceId = getNullableString(record, "trace_id") ?? getNullableString(record, "TraceId");
  const spanId = getNullableString(record, "span_id") ?? getNullableString(record, "SpanId");
  const tieBreaker = buildTieBreaker({
    streamId,
    spanId,
    traceId,
    message,
  });

  return logRowSchema.parse({
    key: `${streamId ?? "unknown"}:${time}:${tieBreaker}`,
    time,
    message,
    streamId,
    stream,
    severity,
    serviceName,
    traceId,
    spanId,
    raw: record,
  });
}

export function extractRawLogRecords(payload: unknown): RawLogRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (value): value is RawLogRecord => typeof value === "object" && value !== null,
    );
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const asObject = payload as Record<string, unknown>;
  const candidates = [asObject.hits, asObject.logs, asObject.data];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate.filter(
      (value): value is RawLogRecord => typeof value === "object" && value !== null,
    );
  }

  return [];
}

export function compareLogRows(left: LogRow, right: LogRow): number {
  const timeDelta = left.time.localeCompare(right.time);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const leftSequence = left.message.match(/^SEQ:(\d+)/)?.[1];
  const rightSequence = right.message.match(/^SEQ:(\d+)/)?.[1];
  if (leftSequence && rightSequence) {
    const leftValue = Number.parseInt(leftSequence, 10);
    const rightValue = Number.parseInt(rightSequence, 10);
    if (!Number.isNaN(leftValue) && !Number.isNaN(rightValue) && leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.key.localeCompare(right.key);
}

export function isBeforeAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string },
): boolean {
  const anchorKey = `${anchor.streamId ?? "unknown"}:${anchor.time}:${anchor.tieBreaker}`;

  if (candidate.time < anchor.time) {
    return true;
  }

  if (candidate.time > anchor.time) {
    return false;
  }

  return candidate.key < anchorKey;
}

export function isAfterAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string },
): boolean {
  const anchorKey = `${anchor.streamId ?? "unknown"}:${anchor.time}:${anchor.tieBreaker}`;

  if (candidate.time > anchor.time) {
    return true;
  }

  if (candidate.time < anchor.time) {
    return false;
  }

  return candidate.key > anchorKey;
}
