import type { LogProfile, ProfileFieldSelector } from "../api/types";

type RawLogRecord = Record<string, unknown>;

type ProfileRenderableField = {
  title?: string;
  field?: string;
  fields?: string[];
  type?: "sql" | "StructuredLoggingFields" | "RemainingFields";
  id?: string;
};

export type ProfileResolvedFieldMatch = {
  key: string;
  value: unknown;
};

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

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function asFieldCandidates(selector: ProfileRenderableField | ProfileFieldSelector): string[] {
  if ("field" in selector && typeof selector.field === "string") {
    return [selector.field];
  }

  if ("fields" in selector && Array.isArray(selector.fields)) {
    return selector.fields;
  }

  return [];
}

export function resolveFieldMatch(
  record: RawLogRecord,
  selector: ProfileRenderableField | ProfileFieldSelector,
): ProfileResolvedFieldMatch | null {
  const candidates = asFieldCandidates(selector);
  for (const fieldName of candidates) {
    if (!(fieldName in record)) {
      continue;
    }

    const value = record[fieldName];
    if (value === null || value === undefined) {
      continue;
    }

    return {
      key: fieldName,
      value,
    };
  }

  return null;
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

export function resolveCoreFieldDisplayText(options: {
  record: RawLogRecord;
  profile: LogProfile | null;
  coreField: keyof LogProfile["coreFields"];
}): string | null {
  const selector = options.profile?.coreFields[options.coreField];
  if (!selector) {
    return null;
  }

  return resolveFieldDisplayText(options.record, selector);
}
