import type { LogsSearch } from "./search";
import { normalizeLogsQuery, WILDCARD_QUERY } from "./search";

export type QuickFilterSelector = {
  field?: string;
  fields?: string[];
};

export type QuickFilterOperator = "=" | "!=";

export type QuickFilterRequest = {
  selector: QuickFilterSelector;
  value: string;
  operator: QuickFilterOperator;
};

type FilterExpressionContext = {
  field: string;
  value: string;
};

export type QuickFilterOperatorFormatter = (context: FilterExpressionContext) => string;

export type LogsQuickFilterService = {
  applyFilter: (search: LogsSearch, request: QuickFilterRequest) => LogsSearch;
};

type CreateLogsQuickFilterServiceOptions = {
  formatters?: Partial<Record<QuickFilterOperator, QuickFilterOperatorFormatter>>;
};

const DEFAULT_OPERATOR_FORMATTERS: Record<QuickFilterOperator, QuickFilterOperatorFormatter> = {
  "=": ({ field, value }) => `${field}:${value}`,
  "!=": ({ field, value }) => `!${field}:${value}`,
};

function quoteFilterValue(value: string): string {
  if (/^[a-zA-Z0-9_.:@/-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function appendFilterToQuery(existingQuery: string, filterExpression: string): string {
  if (!existingQuery || existingQuery === WILDCARD_QUERY) {
    return filterExpression;
  }

  return `${existingQuery} AND ${filterExpression}`;
}

function selectCandidateFields(selector: QuickFilterSelector): string[] {
  const candidates = [selector.field, ...(selector.fields ?? [])].filter((value): value is string =>
    Boolean(value && value.trim().length > 0),
  );

  return [...new Set(candidates)];
}

function buildFilterExpression(options: {
  selector: QuickFilterSelector;
  value: string;
  operator: QuickFilterOperator;
  formatters: Record<QuickFilterOperator, QuickFilterOperatorFormatter>;
}): string | null {
  const formatter = options.formatters[options.operator];

  const fields = selectCandidateFields(options.selector);
  if (fields.length === 0) {
    return null;
  }

  // Prefer the first selector key so quick filters remain predictable even
  // when a profile field defines fallbacks.
  const literal = quoteFilterValue(options.value);
  return formatter({ field: fields[0], value: literal });
}

export function createLogsQuickFilterService(
  options: CreateLogsQuickFilterServiceOptions = {},
): LogsQuickFilterService {
  const formatters = {
    ...DEFAULT_OPERATOR_FORMATTERS,
    ...options.formatters,
  };

  return {
    applyFilter(search, request) {
      const value = request.value.trim();
      if (!value) {
        return search;
      }

      const filterExpression = buildFilterExpression({
        selector: request.selector,
        value,
        operator: request.operator,
        formatters,
      });

      if (!filterExpression) {
        return search;
      }

      const normalizedQuery = normalizeLogsQuery(search.q);

      return {
        ...search,
        q: appendFilterToQuery(normalizedQuery, filterExpression),
      };
    },
  };
}
