const CSS_IDENTIFIER_INVALID_CHARS = /[^a-zA-Z0-9_-]/g;

/**
 * Column ids can contain characters such as dots (for nested field names),
 * which are not valid in CSS custom-property names. Normalize them so every
 * column can safely map to a CSS variable.
 */
export function getColumnSizeVarName(columnId: string): string {
  const safeColumnId = columnId.replace(CSS_IDENTIFIER_INVALID_CHARS, "_");
  return `--col-${safeColumnId}-size`;
}
