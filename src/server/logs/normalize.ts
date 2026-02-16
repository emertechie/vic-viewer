import { createHash } from "node:crypto";
import { logRowSchema, type LogRow } from "../schemas/logs";

type RawLogRecord = Record<string, unknown>;

type LogRowKeyParts = {
  streamId: string | null;
  time: string;
  tieBreaker: string;
};

function isRawLogRecord(value: unknown): value is RawLogRecord {
  return typeof value === "object" && value !== null;
}

function toRawLogRecordArray(value: unknown): RawLogRecord[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(isRawLogRecord);
}

function buildLogRowKey(parts: LogRowKeyParts): string {
  return `${parts.streamId ?? "unknown"}:${parts.time}:${parts.tieBreaker}`;
}

function buildLogRowKeyFromRow(row: Pick<LogRow, "streamId" | "time" | "tieBreaker">): string {
  return buildLogRowKey({
    streamId: row.streamId,
    time: row.time,
    tieBreaker: row.tieBreaker,
  });
}

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
    key: buildLogRowKey({
      streamId,
      time,
      tieBreaker,
    }),
    time,
    tieBreaker,
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
  return toRawLogRecordArray(payload) ?? [];
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

  return buildLogRowKeyFromRow(left).localeCompare(buildLogRowKeyFromRow(right));
}

export function isBeforeAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string },
): boolean {
  const anchorKey = buildLogRowKey(anchor);
  const candidateKey = buildLogRowKeyFromRow(candidate);

  if (candidate.time < anchor.time) {
    return true;
  }

  if (candidate.time > anchor.time) {
    return false;
  }

  return candidateKey < anchorKey;
}

export function isAfterAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string },
): boolean {
  const anchorKey = buildLogRowKey(anchor);
  const candidateKey = buildLogRowKeyFromRow(candidate);

  if (candidate.time > anchor.time) {
    return true;
  }

  if (candidate.time < anchor.time) {
    return false;
  }

  return candidateKey > anchorKey;
}
