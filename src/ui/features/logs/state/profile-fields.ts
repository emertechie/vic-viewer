import type { LogProfile, ProfileFieldSelector } from "../api/types";
import {
  resolveFieldMatchFromSelector,
  resolveFieldTextFromSelector,
  toNonEmptyText,
  type FieldSelectorLike,
  type LogRecord as RawLogRecord,
  type ResolvedFieldMatch,
} from "../../../../shared/logs/field-resolution";

type ProfileRenderableField = {
  title?: string;
  type?: "sql" | "StructuredLoggingFields" | "RemainingFields";
  id?: string;
} & FieldSelectorLike;

export type ProfileResolvedFieldMatch = ResolvedFieldMatch;

function toWordsFromFieldName(fieldName: string): string {
  const first = fieldName.replace(/[._-]+/g, " ");
  return first.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function fieldNameToTitle(fieldName: string): string {
  return toTitleCase(toWordsFromFieldName(fieldName));
}

export function toDisplayText(value: unknown): string | null {
  const primitiveText = toNonEmptyText(value);
  if (primitiveText !== null) {
    return primitiveText;
  }

  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function resolveFieldMatch(
  record: RawLogRecord,
  selector: ProfileRenderableField | ProfileFieldSelector,
): ProfileResolvedFieldMatch | null {
  return resolveFieldMatchFromSelector(record, selector);
}

export function resolveFieldDisplayText(
  record: RawLogRecord,
  selector: ProfileRenderableField | ProfileFieldSelector,
): string | null {
  const resolved = resolveFieldMatch(record, selector);
  if (!resolved) {
    return null;
  }

  return toDisplayText(resolved.value);
}

export function getProfileFieldLabel(field: ProfileRenderableField): string {
  if (field.title) {
    return field.title;
  }

  if (typeof field.field === "string") {
    return fieldNameToTitle(field.field);
  }

  if (Array.isArray(field.fields) && field.fields[0]) {
    return fieldNameToTitle(field.fields[0]);
  }

  if (field.type === "RemainingFields") {
    return "Remaining Fields";
  }

  if (field.type === "StructuredLoggingFields") {
    return "Structured Logging Fields";
  }

  return "Field";
}

export function getProfileFieldIdentifier(field: ProfileRenderableField): string {
  if (field.id) {
    return field.id;
  }

  if (field.field) {
    return field.field;
  }

  if (field.fields?.[0]) {
    return field.fields[0];
  }

  return getProfileFieldLabel(field)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/**
 * Returns the normalized list of raw field keys for a field selector.
 * Allows comparing two selectors that may use `field` vs `fields` differently
 * (e.g. a logTable column with `id:"time", field:"_time"` vs a logDetails
 * field with only `field:"_time"` and no explicit id).
 */
export function getFieldSelectorKeys(
  entry: Pick<ProfileRenderableField, "field" | "fields">,
): string[] {
  if (entry.fields && entry.fields.length > 0) return entry.fields;
  if (entry.field) return [entry.field];
  return [];
}

export function hasFieldSelector(entry: Pick<ProfileRenderableField, "field" | "fields">): boolean {
  return getFieldSelectorKeys(entry).length > 0;
}

/**
 * Check whether a column config entry matches a field selector by comparing
 * the underlying raw field keys. This is the correct way to determine
 * "is this field already shown as a column" because profile table columns
 * and detail-panel fields may have different `id` values for the same data.
 */
export function fieldSelectorsMatch(
  a: Pick<ProfileRenderableField, "field" | "fields">,
  b: Pick<ProfileRenderableField, "field" | "fields">,
): boolean {
  if (!hasFieldSelector(a) || !hasFieldSelector(b)) return false;

  const keysA = getFieldSelectorKeys(a);
  const keysB = getFieldSelectorKeys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, i) => k === keysB[i]);
}

export function resolveCoreFieldDisplayText(options: {
  record: RawLogRecord;
  profile: LogProfile;
  coreField: keyof LogProfile["coreFields"];
}): string | null {
  const selector = options.profile.coreFields[options.coreField];
  if (!selector) {
    return null;
  }

  return resolveFieldTextFromSelector(options.record, selector);
}
