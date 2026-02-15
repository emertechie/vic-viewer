import * as React from "react";
import type { LogsSearch, LogsRange, RelativeRange } from "../state/search";
import { buildRelativeWindow } from "../state/search";

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
  const trimmed = value.trim();
  return trimmed || "*";
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

  const applySearch = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedQuery = queryText.trim();
      const nextQuery = normalizeQuery(queryText);
      if (!trimmedQuery && queryText !== "*") {
        setQueryText("*");
      }

      if (range === "absolute") {
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

      const window = buildRelativeWindow(range as RelativeRange, new Date());
      props.onApplySearch({
        ...props.search,
        q: nextQuery,
        range,
        start: window.start,
        end: window.end,
      });
    },
    [absoluteEnd, absoluteStart, props, queryText, range],
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
        <input
          id="logs-query"
          value={queryText}
          onChange={(event) => setQueryText(event.currentTarget.value)}
          placeholder="*"
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring/60"
        />
      </div>
      <div className="w-28">
        <label htmlFor="logs-range" className="mb-1 block text-xs text-muted-foreground">
          Range
        </label>
        <select
          id="logs-range"
          value={range}
          onChange={(event) => setRange(event.currentTarget.value as LogsRange)}
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
        <p className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
          Unapplied changes
        </p>
      ) : null}
      <button
        type="submit"
        className="h-9 rounded-md border border-primary/70 bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {hasUnappliedChanges ? "Apply Changes" : "Run Query"}
      </button>
    </form>
  );
}
