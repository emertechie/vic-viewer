import * as React from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogRow, LogsPageInfo } from "../api/types";
import { getPageInfoOrDefault } from "../state/paging";

const columns: ColumnDef<LogRow>[] = [
  { accessorKey: "time", header: "Time" },
  { accessorKey: "severity", header: "Level" },
  { accessorKey: "serviceName", header: "Service" },
  { accessorKey: "message", header: "Message" },
  { accessorKey: "traceId", header: "TraceId" },
  { accessorKey: "spanId", header: "SpanId" },
];

const ROW_ESTIMATE_PX = 34;
const SCROLL_THRESHOLD_PX = 180;

type SequenceCheckStatus = "pass_full" | "pass_partial" | "fail" | "none";

function extractSequence(message: string): number | null {
  const match = message.match(/^SEQ:(\d+)/);
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isNaN(sequence) ? null : sequence;
}

function isFakeSequenceMode(rows: LogRow[]): boolean {
  const sample = rows.slice(0, 20);
  if (sample.length === 0) {
    return false;
  }

  return sample.every((row) => extractSequence(row.message) !== null);
}

function getSequenceCheckStatus(rows: LogRow[], index: number): SequenceCheckStatus {
  const current = rows[index];
  if (!current) {
    return "none";
  }

  const hasAbove = index > 0;
  const hasBelow = index < rows.length - 1;
  if (!hasAbove && !hasBelow) {
    return "none";
  }

  const currentSequence = extractSequence(current.message);
  const aboveSequence = hasAbove ? extractSequence(rows[index - 1]?.message ?? "") : null;
  const belowSequence = hasBelow ? extractSequence(rows[index + 1]?.message ?? "") : null;

  if (
    hasAbove &&
    (currentSequence === null || aboveSequence === null || aboveSequence !== currentSequence - 1)
  ) {
    return "fail";
  }

  if (
    hasBelow &&
    (currentSequence === null || belowSequence === null || belowSequence !== currentSequence + 1)
  ) {
    return "fail";
  }

  return hasAbove && hasBelow ? "pass_full" : "pass_partial";
}

function getSequenceRowClasses(status: SequenceCheckStatus): string {
  if (status === "pass_full") {
    return "bg-emerald-500/15 hover:bg-emerald-500/20";
  }

  if (status === "pass_partial") {
    return "bg-sky-500/15 hover:bg-sky-500/20";
  }

  if (status === "fail") {
    return "bg-rose-500/15 hover:bg-rose-500/20";
  }

  return "hover:bg-muted/40";
}

export function LogsTable(props: {
  rows: LogRow[];
  pageInfo: LogsPageInfo | null;
  selectedRowKey?: string;
  loadingOlder: boolean;
  loadingNewer: boolean;
  isLoadingInitial: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
  onSelectRow?: (row: LogRow) => void;
}) {
  const pageInfo = getPageInfoOrDefault(props.pageInfo);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isAtBottomRef = React.useRef(true);
  // Programmatic scroll-to-bottom during initial render can fire onScroll and
  // immediately trigger paging. This guard ignores those synthetic events briefly.
  const suppressPagingUntilRef = React.useRef(0);
  const [pagingNotice, setPagingNotice] = React.useState<string | null>(null);
  const previousLoadingStateRef = React.useRef({
    older: false,
    newer: false,
  });
  const olderLoadStartRowsRef = React.useRef<number | null>(null);
  const newerLoadStartRowsRef = React.useRef<number | null>(null);
  const fakeSequenceMode = React.useMemo(() => isFakeSequenceMode(props.rows), [props.rows]);
  const table = useReactTable({
    data: props.rows,
    columns,
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
  });

  const rowModel = table.getRowModel();
  const virtualizer = useVirtualizer({
    count: rowModel.rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 12,
  });

  const loadOlderWithAnchor = React.useCallback(async () => {
    if (!pageInfo.hasOlder || props.loadingOlder) {
      return;
    }

    const scrollElement = containerRef.current;
    if (!scrollElement) {
      return;
    }

    const previousHeight = scrollElement.scrollHeight;
    const previousTop = scrollElement.scrollTop;
    await props.onLoadOlder();

    requestAnimationFrame(() => {
      const currentElement = containerRef.current;
      if (!currentElement) {
        return;
      }

      const heightDelta = currentElement.scrollHeight - previousHeight;
      currentElement.scrollTop = previousTop + heightDelta;
    });
  }, [pageInfo.hasOlder, props]);

  const loadNewer = React.useCallback(async () => {
    if (!pageInfo.hasNewer || props.loadingNewer) {
      return;
    }

    await props.onLoadNewer();
  }, [pageInfo.hasNewer, props]);

  const onScroll = React.useCallback(async () => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    if (Date.now() < suppressPagingUntilRef.current) {
      return;
    }

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isAtBottomRef.current = distanceToBottom < 24;

    if (element.scrollTop < SCROLL_THRESHOLD_PX) {
      await loadOlderWithAnchor();
    }

    if (distanceToBottom < SCROLL_THRESHOLD_PX) {
      await loadNewer();
    }
  }, [loadNewer, loadOlderWithAnchor]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element || !isAtBottomRef.current) {
      return;
    }

    suppressPagingUntilRef.current = Date.now() + 400;
    element.scrollTop = element.scrollHeight;
  }, [props.rows.length]);

  React.useEffect(() => {
    if (!fakeSequenceMode) {
      setPagingNotice(null);
      previousLoadingStateRef.current = {
        older: props.loadingOlder,
        newer: props.loadingNewer,
      };
      return;
    }

    const previous = previousLoadingStateRef.current;

    if (!previous.older && props.loadingOlder) {
      olderLoadStartRowsRef.current = props.rows.length;
    }

    if (!previous.newer && props.loadingNewer) {
      newerLoadStartRowsRef.current = props.rows.length;
    }

    if (previous.older && !props.loadingOlder) {
      const startRows = olderLoadStartRowsRef.current;
      if (startRows !== null) {
        const loadedRows = props.rows.length - startRows;
        if (loadedRows > 0) {
          setPagingNotice(`Loaded ${loadedRows} older rows`);
        }
      }
      olderLoadStartRowsRef.current = null;
    }

    if (previous.newer && !props.loadingNewer) {
      const startRows = newerLoadStartRowsRef.current;
      if (startRows !== null) {
        const loadedRows = props.rows.length - startRows;
        if (loadedRows > 0) {
          setPagingNotice(`Loaded ${loadedRows} newer rows`);
        }
      }
      newerLoadStartRowsRef.current = null;
    }

    previousLoadingStateRef.current = {
      older: props.loadingOlder,
      newer: props.loadingNewer,
    };
  }, [fakeSequenceMode, props.loadingNewer, props.loadingOlder, props.rows.length]);

  React.useEffect(() => {
    if (!pagingNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPagingNotice(null);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pagingNotice]);

  if (props.isLoadingInitial) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading logs...
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {props.errorMessage ? (
        <div className="border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {props.errorMessage}
        </div>
      ) : null}
      <div className="grid shrink-0 grid-cols-[210px_90px_220px_minmax(420px,1fr)_320px_320px] border-b border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div key={header.id} className="truncate px-1">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          )),
        )}
      </div>
      <div ref={containerRef} onScroll={() => void onScroll()} className="flex-1 overflow-auto">
        <div
          className="relative min-w-[1500px]"
          style={{
            height: virtualizer.getTotalSize(),
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rowModel.rows[virtualRow.index];
            const sequenceStatus = fakeSequenceMode
              ? getSequenceCheckStatus(props.rows, virtualRow.index)
              : "none";
            return (
              <div
                key={row.id}
                onClick={() => props.onSelectRow?.(row.original)}
                className={`absolute left-0 grid w-full grid-cols-[210px_90px_220px_minmax(420px,1fr)_320px_320px] border-b border-border/60 px-3 text-xs ${getSequenceRowClasses(
                  sequenceStatus,
                )} ${props.selectedRowKey === row.id ? "ring-1 ring-inset ring-primary/60" : ""} ${
                  props.onSelectRow ? "cursor-pointer" : ""
                }`}
                style={{
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="self-center truncate px-1 text-foreground/90">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          Rows: {props.rows.length}
          {props.isRefreshing ? " • refreshing..." : ""}
        </span>
        <span>
          {pageInfo.hasOlder ? "older available" : "oldest loaded"} •{" "}
          {pageInfo.hasNewer ? "newer available" : "newest loaded"}
        </span>
      </div>
      {fakeSequenceMode && pagingNotice ? (
        <div className="pointer-events-none absolute bottom-12 right-3 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200 shadow-sm">
          {pagingNotice}
        </div>
      ) : null}
    </div>
  );
}
