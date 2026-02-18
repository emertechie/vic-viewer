import * as React from "react";
import { Columns } from "lucide-react";

/** Small toolbar row above the table with the "Columns" button. */
export function LogsTableToolbar(props: { onOpenColumnPicker: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
      <button
        type="button"
        onClick={props.onOpenColumnPicker}
        className="inline-flex items-center gap-1.5 rounded border border-input px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
      >
        <Columns className="h-3.5 w-3.5" aria-hidden />
        Columns
      </button>
    </div>
  );
}
