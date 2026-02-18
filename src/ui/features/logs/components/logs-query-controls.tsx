import * as React from "react";
import { Play, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import type { LogsSearch, LogsRange, RelativeRange } from "../state/search";
import { buildRelativeWindow, normalizeLogsQuery, WILDCARD_QUERY } from "../state/search";

function toLocalDateTimeValue(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeValue(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function normalizeQuery(value: string): string {
  return normalizeLogsQuery(value);
}

export function LogsQueryControls(props: {
  search: LogsSearch;
  onApplySearch: (nextSearch: LogsSearch) => void;
  onToggleLive: (liveMode: "0" | "1") => void;
}) {
  const [queryText, setQueryText] = React.useState(props.search.q);
  const [range, setRange] = React.useState<LogsRange>(props.search.range);
  const [absoluteStart, setAbsoluteStart] = React.useState(
    toLocalDateTimeValue(props.search.start),
  );
  const [absoluteEnd, setAbsoluteEnd] = React.useState(toLocalDateTimeValue(props.search.end));
  const appliedAbsoluteStart = toLocalDateTimeValue(props.search.start);
  const appliedAbsoluteEnd = toLocalDateTimeValue(props.search.end);
  const hasUnappliedChanges = React.useMemo(() => {
    if (normalizeQuery(queryText) !== normalizeQuery(props.search.q)) {
      return true;
    }

    if (range !== props.search.range) {
      return true;
    }

    if (range === "absolute") {
      return absoluteStart !== appliedAbsoluteStart || absoluteEnd !== appliedAbsoluteEnd;
    }

    return false;
  }, [
    absoluteEnd,
    absoluteStart,
    appliedAbsoluteEnd,
    appliedAbsoluteStart,
    props.search.q,
    props.search.range,
    queryText,
    range,
  ]);

  React.useEffect(() => {
    setQueryText(props.search.q);
    setRange(props.search.range);
    setAbsoluteStart(toLocalDateTimeValue(props.search.start));
    setAbsoluteEnd(toLocalDateTimeValue(props.search.end));
  }, [props.search.end, props.search.q, props.search.range, props.search.start]);

  const doApplySearch = React.useCallback(
    (nextRange: LogsRange, nextQueryText: string) => {
      const trimmedQuery = nextQueryText.trim();
      const nextQuery = normalizeQuery(nextQueryText);
      if (!trimmedQuery && nextQueryText !== WILDCARD_QUERY) {
        setQueryText(WILDCARD_QUERY);
      }

      if (nextRange === "absolute") {
        if (!absoluteStart || !absoluteEnd) {
          return;
        }

        props.onApplySearch({
          ...props.search,
          q: nextQuery,
          range: "absolute",
          start: fromLocalDateTimeValue(absoluteStart),
          end: fromLocalDateTimeValue(absoluteEnd),
        });
        return;
      }

      const window = buildRelativeWindow(nextRange as RelativeRange, new Date());
      props.onApplySearch({
        ...props.search,
        q: nextQuery,
        range: nextRange,
        start: window.start,
        end: window.end,
      });
    },
    [absoluteEnd, absoluteStart, props],
  );

  const applySearch = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      doApplySearch(range, queryText);
    },
    [doApplySearch, range, queryText],
  );

  const clearQueryToWildcard = React.useCallback(() => {
    setQueryText(WILDCARD_QUERY);
    doApplySearch(range, WILDCARD_QUERY);
  }, [doApplySearch, range]);

  const runQueryButton = (
    <button
      type="submit"
      className="relative inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Play className="h-3.5 w-3.5" aria-hidden />
      Run Query
      {hasUnappliedChanges ? (
        <span
          className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-card"
          aria-hidden
        />
      ) : null}
    </button>
  );

  return (
    <form
      onSubmit={applySearch}
      className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-3"
    >
      <div className="min-w-[220px] flex-1">
        <label htmlFor="logs-query" className="mb-1 block text-xs text-muted-foreground">
          LogsQL
        </label>
        <div className="relative">
          <input
            id="logs-query"
            value={queryText}
            onChange={(event) => setQueryText(event.currentTarget.value)}
            placeholder={WILDCARD_QUERY}
            className="h-9 w-full rounded-md border border-input bg-card pl-3 pr-9 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring/60"
          />
          <button
            type="button"
            onClick={clearQueryToWildcard}
            aria-label='Clear query to "*"'
            className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="w-28">
        <label htmlFor="logs-range" className="mb-1 block text-xs text-muted-foreground">
          Range
        </label>
        <select
          id="logs-range"
          value={range}
          onChange={(event) => {
            const nextRange = event.currentTarget.value as LogsRange;
            setRange(nextRange);
            if (nextRange !== "absolute") {
              doApplySearch(nextRange, queryText);
            }
          }}
          className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring/60"
        >
          <option value="5m">Last 5m</option>
          <option value="15m">Last 15m</option>
          <option value="1h">Last 1h</option>
          <option value="6h">Last 6h</option>
          <option value="24h">Last 24h</option>
          <option value="absolute">Absolute</option>
        </select>
      </div>
      {range === "absolute" ? (
        <>
          <div>
            <label
              htmlFor="logs-absolute-start"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Start
            </label>
            <input
              id="logs-absolute-start"
              type="datetime-local"
              value={absoluteStart}
              onChange={(event) => setAbsoluteStart(event.currentTarget.value)}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring/60"
            />
          </div>
          <div>
            <label htmlFor="logs-absolute-end" className="mb-1 block text-xs text-muted-foreground">
              End
            </label>
            <input
              id="logs-absolute-end"
              type="datetime-local"
              value={absoluteEnd}
              onChange={(event) => setAbsoluteEnd(event.currentTarget.value)}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring/60"
            />
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => props.onToggleLive(props.search.live === "1" ? "0" : "1")}
        className={`h-9 rounded-md border px-3 text-sm ${
          props.search.live === "1"
            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
            : "border-input bg-card text-muted-foreground"
        }`}
      >
        {props.search.live === "1" ? "Live On" : "Live Off"}
      </button>
      {hasUnappliedChanges ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{runQueryButton}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Run query to apply changes
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        runQueryButton
      )}
    </form>
  );
}
