import * as React from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import type { LogRow } from "../api/types";

export function LogsTableHeader(props: { table: Table<LogRow>; gridTemplateColumns: string }) {
  return (
    <div
      className="grid shrink-0 border-b border-border bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-muted/30"
      style={{ gridTemplateColumns: props.gridTemplateColumns }}
    >
      {props.table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header) => (
          <div key={header.id} className="truncate px-1">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        )),
      )}
    </div>
  );
}
