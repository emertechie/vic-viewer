import * as React from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import type { LogRow } from "../api/types";

export function LogsTableHeader(props: { table: Table<LogRow> }) {
  return (
    <div
      className="sticky top-0 z-10 flex border-b border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
      style={{ width: "100%" }}
    >
      {props.table.getHeaderGroups().map((headerGroup) =>
        headerGroup.headers.map((header) => (
          <div
            key={header.id}
            className="shrink-0 truncate px-1"
            style={{ width: header.getSize() }}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        )),
      )}
    </div>
  );
}
