import * as React from "react";

export function LogsTableFooter(props: {
  rowCount: number;
  isRefreshing: boolean;
  hasOlder: boolean;
  hasNewer: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <span>
        Rows: {props.rowCount}
        {props.isRefreshing ? " • refreshing..." : ""}
      </span>
      <span>
        {props.hasOlder ? "older available" : "oldest loaded"} •{" "}
        {props.hasNewer ? "newer available" : "newest loaded"}
      </span>
    </div>
  );
}

export function LogsTablePagingNotice(props: { message: string }) {
  return (
    <div className="pointer-events-none absolute bottom-14 right-4 rounded-lg border border-sky-300 bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg">
      {props.message}
    </div>
  );
}
