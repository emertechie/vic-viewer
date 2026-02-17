import type { LogProfile, LogRow } from "../api/types";
import {
  fieldNameToTitle,
  getProfileFieldIdentifier,
  getProfileFieldLabel,
  resolveFieldMatch,
  toDisplayText,
} from "../state/profile-fields";

export type DrawerFieldRow = {
  id: string;
  label: string;
  value: string | null;
  valueType: "text" | "sql";
};
export type DrawerFieldSet = { id: string; name: string; rows: DrawerFieldRow[] };

function parseOriginalFormatTokens(originalFormat: string): string[] {
  const tokenSet = new Set<string>();
  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(originalFormat);
  while (match) {
    const token = match[1]?.trim();
    if (token) {
      tokenSet.add(token);
    }
    match = regex.exec(originalFormat);
  }

  return [...tokenSet].sort((left, right) => left.localeCompare(right));
}

export function buildProfileFieldSets(row: LogRow, profile: LogProfile): DrawerFieldSet[] {
  const renderedKeys = new Set<string>();
  const sets: DrawerFieldSet[] = [];

  for (const [fieldSetIndex, fieldSet] of profile.logDetails.fieldSets.entries()) {
    const rows: DrawerFieldRow[] = [];

    for (const [fieldIndex, field] of fieldSet.fields.entries()) {
      if (field.type === "StructuredLoggingFields") {
        const originalFormatMatch = resolveFieldMatch(row.raw, { field: "{OriginalFormat}" });
        const originalFormatText = originalFormatMatch
          ? toDisplayText(originalFormatMatch.value)
          : null;
        if (!originalFormatText) {
          continue;
        }

        for (const token of parseOriginalFormatTokens(originalFormatText)) {
          if (renderedKeys.has(token)) {
            continue;
          }

          const tokenMatch = resolveFieldMatch(row.raw, { field: token });
          if (!tokenMatch) {
            continue;
          }

          rows.push({
            id: `${fieldSetIndex}-${fieldIndex}-structured-${token}`,
            label: fieldNameToTitle(token),
            value: toDisplayText(tokenMatch.value),
            valueType: "text",
          });
          renderedKeys.add(tokenMatch.key);
        }

        continue;
      }

      if (field.type === "RemainingFields") {
        for (const rawKey of Object.keys(row.raw).sort((left, right) =>
          left.localeCompare(right),
        )) {
          if (renderedKeys.has(rawKey)) {
            continue;
          }

          const value = toDisplayText(row.raw[rawKey]);
          if (value === null) {
            continue;
          }

          rows.push({
            id: `${fieldSetIndex}-${fieldIndex}-remaining-${rawKey}`,
            label: fieldNameToTitle(rawKey),
            value,
            valueType: "text",
          });
          renderedKeys.add(rawKey);
        }

        continue;
      }

      const matched = resolveFieldMatch(row.raw, field);
      const value = matched ? toDisplayText(matched.value) : null;
      rows.push({
        id: `${fieldSetIndex}-${fieldIndex}-${getProfileFieldIdentifier(field)}`,
        label: getProfileFieldLabel(field),
        value,
        valueType: field.type === "sql" ? "sql" : "text",
      });

      if (matched) {
        renderedKeys.add(matched.key);
      }
    }

    if (rows.length > 0) {
      sets.push({
        id: fieldSet.id ?? `${fieldSet.name}-${fieldSetIndex}`,
        name: fieldSet.name,
        rows,
      });
    }
  }

  return sets;
}
