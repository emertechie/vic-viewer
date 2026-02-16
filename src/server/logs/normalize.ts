import { createHash } from "node:crypto";
import type { ProfileFieldSelector } from "../schemas/logProfiles";
import { logRowSchema, type LogRow } from "../schemas/logs";
import type { LogProfile } from "../schemas/logProfiles";

type RawLogRecord = Record<string, unknown>;

type LogRowKeyParts = {
  streamId: string | null;
  time: string;
  tieBreaker: string;
};

type SortTarget = {
  time: string;
  key: string;
  sequence: number | null;
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

export function extractLogSequence(message: string): number | null {
  const sequenceMatch = message.match(/^SEQ:(\d+)/);
  if (!sequenceMatch) {
    return null;
  }

  const parsed = Number.parseInt(sequenceMatch[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNonEmptyText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function resolveProfileFieldText(
  record: RawLogRecord,
  selector: ProfileFieldSelector | undefined,
): string | null {
  if (!selector) {
    return null;
  }

  if ("field" in selector) {
    return toNonEmptyText(record[selector.field]);
  }

  for (const field of selector.fields) {
    const candidate = toNonEmptyText(record[field]);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function buildSortTargetFromRow(row: LogRow, profile: LogProfile): SortTarget {
  return {
    time: row.time,
    key: buildLogRowKeyFromRow(row),
    sequence: extractLogSequenceFromRow(row, profile),
  };
}

function buildSortTargetFromAnchor(anchor: {
  time: string;
  streamId: string | null;
  tieBreaker: string;
  sequence?: number;
}): SortTarget {
  return {
    time: anchor.time,
    key: buildLogRowKey(anchor),
    sequence: anchor.sequence ?? null,
  };
}

function compareSortTargets(left: SortTarget, right: SortTarget): number {
  const timeDelta = left.time.localeCompare(right.time);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  if (left.sequence !== null && right.sequence !== null && left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.key.localeCompare(right.key);
}

function toIsoDate(value: unknown): string | null {
  const asText = toNonEmptyText(value);
  if (!asText) {
    return null;
  }

  const parsed = new Date(asText);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function buildTieBreaker(record: RawLogRecord, profile: LogProfile): string {
  const tieSource = profile.tieBreaker.fields
    .map((fieldName) => resolveProfileFieldText(record, { field: fieldName }) ?? "")
    .join(":");
  return createHash("sha1").update(tieSource).digest("hex");
}

export function normalizeLogRecord(record: RawLogRecord, profile: LogProfile): LogRow | null {
  const time = toIsoDate(resolveProfileFieldText(record, profile.coreFields.time));
  if (!time) {
    return null;
  }

  const message = resolveProfileFieldText(record, profile.coreFields.message) ?? "";
  const streamId = resolveProfileFieldText(record, profile.coreFields.streamId);
  const stream = resolveProfileFieldText(record, profile.coreFields.stream);
  const severity = resolveProfileFieldText(record, profile.coreFields.severity);
  const serviceName = resolveProfileFieldText(record, profile.coreFields.serviceName);
  const traceId = resolveProfileFieldText(record, profile.coreFields.traceId);
  const spanId = resolveProfileFieldText(record, profile.coreFields.spanId);
  const tieBreaker = buildTieBreaker(record, profile);

  return logRowSchema.parse({
    key: buildLogRowKey({
      streamId,
      time,
      tieBreaker,
    }),
    time,
    tieBreaker,
    message, // TODO: remove
    streamId, // TODO: remove
    stream, // TODO: remove
    severity, // TODO: remove
    serviceName, // TODO: remove
    traceId, // TODO: remove
    spanId, // TODO: remove
    raw: record,
  });
}

export function extractRawLogRecords(payload: unknown): RawLogRecord[] {
  return toRawLogRecordArray(payload) ?? [];
}

export function extractLogSequenceFromRow(row: LogRow, profile: LogProfile): number | null {
  const messageFromRaw = resolveProfileFieldText(row.raw, profile.coreFields.message);
  if (!messageFromRaw) {
    return extractLogSequence(row.message);
  }

  return extractLogSequence(messageFromRaw);
}

export function compareLogRows(left: LogRow, right: LogRow, profile: LogProfile): number {
  return compareSortTargets(
    buildSortTargetFromRow(left, profile),
    buildSortTargetFromRow(right, profile),
  );
}

export function isBeforeAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string; sequence?: number },
  profile: LogProfile,
): boolean {
  return (
    compareSortTargets(
      buildSortTargetFromRow(candidate, profile),
      buildSortTargetFromAnchor(anchor),
    ) < 0
  );
}

export function isAfterAnchor(
  candidate: LogRow,
  anchor: { time: string; streamId: string | null; tieBreaker: string; sequence?: number },
  profile: LogProfile,
): boolean {
  return (
    compareSortTargets(
      buildSortTargetFromRow(candidate, profile),
      buildSortTargetFromAnchor(anchor),
    ) > 0
  );
}
