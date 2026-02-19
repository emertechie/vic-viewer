import { createHash } from "node:crypto";
import { logRowSchema, type LogRow } from "../schemas/logs";
import type { LogProfile } from "../schemas/logProfiles";
import {
  resolveFieldTextFromSelector,
  toNonEmptyText,
  type LogRecord as RawLogRecord,
} from "@/shared/logs/field-resolution";
import { extractLogSequence } from "@/shared/logs/sequence";

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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRawLogRecordArray(value: unknown): RawLogRecord[] | null {
  if (isRawLogRecord(value)) {
    return [value];
  }

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
    .map((fieldName) => resolveFieldTextFromSelector(record, { field: fieldName }) ?? "")
    .join(":");
  return createHash("sha1").update(tieSource).digest("hex");
}

export function normalizeLogRecord(record: RawLogRecord, profile: LogProfile): LogRow | null {
  const time = toIsoDate(resolveFieldTextFromSelector(record, profile.coreFields.time));
  if (!time) {
    return null;
  }

  const streamId = resolveFieldTextFromSelector(record, profile.coreFields.streamId);
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
  const messageFromRaw = resolveFieldTextFromSelector(row.raw, profile.coreFields.message);
  return messageFromRaw ? extractLogSequence(messageFromRaw) : null;
}

export function extractStreamIdFromRow(
  row: Pick<LogRow, "raw">,
  profile: LogProfile,
): string | null {
  return resolveFieldTextFromSelector(row.raw, profile.coreFields.streamId);
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
