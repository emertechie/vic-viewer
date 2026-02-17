export type LogRecord = Record<string, unknown>;

export type FieldSelectorLike = {
  field?: string;
  fields?: string[];
};

export type ResolvedFieldMatch = {
  key: string;
  value: unknown;
};

function fieldCandidates(selector: FieldSelectorLike | undefined): string[] {
  if (!selector) {
    return [];
  }

  if (typeof selector.field === "string") {
    return [selector.field];
  }

  if (Array.isArray(selector.fields)) {
    return selector.fields;
  }

  return [];
}

function hasRenderableValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export function toNonEmptyText(value: unknown): string | null {
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

export function resolveFieldMatchFromSelector(
  record: LogRecord,
  selector: FieldSelectorLike | undefined,
): ResolvedFieldMatch | null {
  for (const fieldName of fieldCandidates(selector)) {
    if (!(fieldName in record)) {
      continue;
    }

    const value = record[fieldName];
    if (!hasRenderableValue(value)) {
      continue;
    }

    return {
      key: fieldName,
      value,
    };
  }

  return null;
}

export function resolveFieldTextFromSelector(
  record: LogRecord,
  selector: FieldSelectorLike | undefined,
): string | null {
  for (const fieldName of fieldCandidates(selector)) {
    const candidate = toNonEmptyText(record[fieldName]);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}
