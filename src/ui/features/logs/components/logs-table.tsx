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

export function LogsTable(props: {
  rows: LogRow[];
  pageInfo: LogsPageInfo | null;
  loadingOlder: boolean;
  loadingNewer: boolean;
  isLoadingInitial: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
}) {
  const pageInfo = getPageInfoOrDefault(props.pageInfo);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isAtBottomRef = React.useRef(true);
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

    element.scrollTop = element.scrollHeight;
  }, [props.rows.length]);

  if (props.isLoadingInitial) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading logs...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
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
            return (
              <div
                key={row.id}
                className="absolute left-0 grid w-full grid-cols-[210px_90px_220px_minmax(420px,1fr)_320px_320px] border-b border-border/60 px-3 text-xs"
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
    </div>
  );
}
