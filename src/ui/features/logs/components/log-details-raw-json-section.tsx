import * as React from "react";
import { Switch } from "@/ui/components/ui/switch";

export function LogDetailsRawJsonSection(props: {
  raw: Record<string, unknown>;
  wrapRawJson: boolean;
  onWrapRawJsonChange: (next: boolean) => void;
}) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Raw JSON
      </h3>
      <pre
        className={`max-h-72 overflow-auto rounded border border-border bg-muted/30 p-2 text-[11px] ${
          props.wrapRawJson ? "whitespace-pre-wrap break-all" : "whitespace-pre"
        }`}
      >
        {JSON.stringify(props.raw, null, 2)}
      </pre>
      <div className="mb-2 mt-2 flex justify-end">
        <label
          htmlFor="wrap-raw-json"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
        >
          Wrap text
          <Switch
            id="wrap-raw-json"
            size="sm"
            checked={props.wrapRawJson}
            onCheckedChange={props.onWrapRawJsonChange}
          />
        </label>
      </div>
    </section>
  );
}
