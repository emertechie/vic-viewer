import * as React from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ColumnConfigEntry, LogProfile, LogRow, LogsPageInfo } from "../api/types";
import { useLogsTablePaging } from "../hooks/use-logs-table-paging";
import { getPageInfoOrDefault } from "../state/paging";
import { resolveFieldDisplayText } from "../state/profile-fields";
import { isFakeSequenceMode, LogsTableBody } from "./logs-table-body";
import { LogsTableFooter, LogsTablePagingNotice } from "./logs-table-footer";
import { LogsTableHeader } from "./logs-table-header";

const ROW_ESTIMATE_PX = 34;

/** Horizontal padding (px-3 = 12px each side) applied to header and row containers. */
const TABLE_ROW_PADDING_PX = 24;

/** Map column config entry to a default pixel width for TanStack column sizing. */
function getDefaultColumnSize(column: ColumnConfigEntry): number {
  const id = column.id.toLowerCase();
  const title = column.title.toLowerCase();
  if (id.includes("time") || title === "time") return 210;
  if (id.includes("level") || id.includes("severity") || title === "level") return 90;
  if (id.includes("message") || title === "message") return 420;
  if (id.includes("trace") || id.includes("span")) return 320;
  if (id.includes("service") || title === "service") return 220;
  return 180;
}

/**
 * Find the column that should absorb extra horizontal space when total
 * column width is less than the viewport. Prefers the "message" column;
 * falls back to the last column.
 */
function findFlexColumnId(visibleColumns: ColumnConfigEntry[]): string | undefined {
  const messageCol = visibleColumns.find((c) => {
    const id = c.id.toLowerCase();
    const title = c.title.toLowerCase();
    return id.includes("message") || title === "message";
  });
  return messageCol?.id ?? visibleColumns.at(-1)?.id;
}

export function LogsTable(props: {
  rows: LogRow[];
  pageInfo: LogsPageInfo | null;
  activeProfile: LogProfile;
  visibleColumns: ColumnConfigEntry[];
  selectedRowKey?: string;
  loadingOlder: boolean;
  loadingNewer: boolean;
  isLoadingInitial: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
  onSelectRow?: (row: LogRow) => void;
  onColumnReorder?: (newOrder: string[]) => void;
  onColumnResize?: (columnId: string, width: number) => void;
}) {
  const pageInfo = getPageInfoOrDefault(props.pageInfo);
  const columns = React.useMemo<ColumnDef<LogRow>[]>(() => {
    return props.visibleColumns.map((column) => ({
      id: column.id,
      header: column.title,
      size: column.width ?? getDefaultColumnSize(column),
      minSize: 50,
      cell: (context) => {
        const row = context.row.original;
        if (column.field || column.fields) {
          return resolveFieldDisplayText(row.raw, {
            field: column.field,
            fields: column.fields,
          });
        }

        return null;
      },
    }));
  }, [props.visibleColumns]);
  const columnOrder = React.useMemo(() => columns.map((c) => c.id!), [columns]);

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

  const fakeSequenceMode = React.useMemo(
    () => isFakeSequenceMode(props.rows, props.activeProfile),
    [props.activeProfile, props.rows],
  );
  const { containerRef, handleScroll, pagingNotice } = useLogsTablePaging({
    rowsLength: props.rows.length,
    hasOlder: pageInfo.hasOlder,
    hasNewer: pageInfo.hasNewer,
    loadingOlder: props.loadingOlder,
    loadingNewer: props.loadingNewer,
    fakeSequenceMode,
    onLoadOlder: props.onLoadOlder,
    onLoadNewer: props.onLoadNewer,
  });
  const table = useReactTable({
    data: props.rows,
    columns,
    state: { columnOrder, columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
  });

  // Track the scroll container's width so we can expand columns to fill the viewport.
  const [containerWidth, setContainerWidth] = React.useState(0);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const flexColumnId = React.useMemo(
    () => findFlexColumnId(props.visibleColumns),
    [props.visibleColumns],
  );

  const columnSizingInfo = table.getState().columnSizingInfo;
  const isResizing = columnSizingInfo.isResizingColumn !== false;

  // Persist column width when resize ends
  const onColumnResizeRef = React.useRef(props.onColumnResize);
  onColumnResizeRef.current = props.onColumnResize;
  const columnSizingRef = React.useRef(columnSizing);
  columnSizingRef.current = columnSizing;

  const prevIsResizingRef = React.useRef(false);
  React.useEffect(() => {
    if (prevIsResizingRef.current && !isResizing) {
      // Resize just finished — persist all changed column widths
      for (const [colId, width] of Object.entries(columnSizingRef.current)) {
        onColumnResizeRef.current?.(colId, Math.round(width));
      }
    }

    prevIsResizingRef.current = isResizing;
  }, [isResizing]);

  /**
   * Precompute CSS variables for column sizes so that cells can read widths
   * from CSS without triggering React re-renders during an active resize.
   *
   * When the total column width is narrower than the container, the flex
   * column (message or last) is inflated to fill the remaining space.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getLeafHeaders();
    const vars: Record<string, number> = {};
    let totalSize = 0;
    for (const header of headers) {
      const size = header.column.getSize();
      vars[`--col-${header.column.id}-size`] = size;
      totalSize += size;
    }

    // If viewport is wider than column total, expand the flex column.
    const availableWidth = containerWidth - TABLE_ROW_PADDING_PX;
    if (flexColumnId && availableWidth > totalSize) {
      const extraSpace = availableWidth - totalSize;
      const currentSize = vars[`--col-${flexColumnId}-size`] ?? 0;
      vars[`--col-${flexColumnId}-size`] = currentSize + extraSpace;
      totalSize = availableWidth;
    }

    vars["--table-width"] = totalSize;
    return vars;
    // columnSizingInfo + columnSizing are needed so the memo recalculates during
    // resize drags (the `table` ref itself is stable and won't trigger updates).
  }, [columnSizingInfo, columnSizing, columns, table, containerWidth, flexColumnId]);

  const rowModel = table.getRowModel();
  const selectedRowIndex = React.useMemo(() => {
    if (!props.selectedRowKey) {
      return -1;
    }

    return props.rows.findIndex((row) => row.key === props.selectedRowKey);
  }, [props.rows, props.selectedRowKey]);
  const virtualizer = useVirtualizer({
    count: rowModel.rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 12,
  });

  React.useEffect(() => {
    if (selectedRowIndex < 0) {
      return;
    }

    virtualizer.scrollToIndex(selectedRowIndex, { align: "auto" });
  }, [selectedRowIndex, virtualizer]);

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
      {/* Single scroll container for header + body so they scroll horizontally together */}
      <div ref={containerRef} onScroll={() => void handleScroll()} className="flex-1 overflow-auto">
        <div style={{ minWidth: "100%", ...columnSizeVars }}>
          <LogsTableHeader
            table={table}
            columnOrder={columnOrder}
            onColumnReorder={props.onColumnReorder}
            scrollContainerRef={containerRef}
          />
          <LogsTableBody
            virtualizer={virtualizer}
            rowModel={rowModel}
            rows={props.rows}
            activeProfile={props.activeProfile}
            fakeSequenceMode={fakeSequenceMode}
            selectedRowKey={props.selectedRowKey}
            onSelectRow={props.onSelectRow}
          />
        </div>
      </div>
      <LogsTableFooter
        rowCount={props.rows.length}
        isRefreshing={props.isRefreshing}
        hasOlder={pageInfo.hasOlder}
        hasNewer={pageInfo.hasNewer}
      />
      {fakeSequenceMode && pagingNotice ? <LogsTablePagingNotice message={pagingNotice} /> : null}
    </div>
  );
}
