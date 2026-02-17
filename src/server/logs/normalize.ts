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

function buildLogRowKeyFromRow(
  row: Pick<LogRow, "time" | "tieBreaker" | "raw">,
  profile: LogProfile,
): string {
  return buildLogRowKey({
    streamId: extractStreamIdFromRow(row, profile),
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

export function resolveProfileFieldText(
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
    key: buildLogRowKeyFromRow(row, profile),
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

  const streamId = resolveProfileFieldText(record, profile.coreFields.streamId);
  const tieBreaker = buildTieBreaker(record, profile);

  return logRowSchema.parse({
    key: buildLogRowKey({
      streamId,
      time,
      tieBreaker,
    }),
    time,
    tieBreaker,
    raw: record,
  });
}

export function extractRawLogRecords(payload: unknown): RawLogRecord[] {
  return toRawLogRecordArray(payload) ?? [];
}

export function extractLogSequenceFromRow(row: LogRow, profile: LogProfile): number | null {
  const messageFromRaw = resolveProfileFieldText(row.raw, profile.coreFields.message);
  return messageFromRaw ? extractLogSequence(messageFromRaw) : null;
}

export function extractStreamIdFromRow(
  row: Pick<LogRow, "raw">,
  profile: LogProfile,
): string | null {
  return resolveProfileFieldText(row.raw, profile.coreFields.streamId);
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
