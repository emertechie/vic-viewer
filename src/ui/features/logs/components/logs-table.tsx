import * as React from "react";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ColumnConfigEntry, LogProfile, LogRow, LogsPageInfo } from "../api/types";
import { useLogsTablePaging } from "../hooks/use-logs-table-paging";
import { getPageInfoOrDefault } from "../state/paging";
import { resolveFieldDisplayText } from "../state/profile-fields";
import { isFakeSequenceMode, LogsTableBody } from "./logs-table-body";
import { LogsTableFooter, LogsTablePagingNotice } from "./logs-table-footer";
import { LogsTableHeader } from "./logs-table-header";

const ROW_ESTIMATE_PX = 34;

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
}) {
  const pageInfo = getPageInfoOrDefault(props.pageInfo);
  const columns = React.useMemo<ColumnDef<LogRow>[]>(() => {
    return props.visibleColumns.map((column) => ({
      id: column.id,
      header: column.title,
      size: column.width ?? getDefaultColumnSize(column),
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
    state: { columnOrder },
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
  });

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
        <div style={{ width: table.getTotalSize() }}>
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
            tableWidth={table.getTotalSize()}
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
