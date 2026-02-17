import * as React from "react";
import { Switch } from "@/ui/components/ui/switch";
import { LogDetailsCodeBlock } from "./log-details-code-block";

export function LogDetailsRawJsonSection(props: {
  raw: Record<string, unknown>;
  wrapRawJson: boolean;
  onWrapRawJsonChange: (next: boolean) => void;
}) {
  const serialized = React.useMemo(() => JSON.stringify(props.raw, null, 2), [props.raw]);

  return (
    <section>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Raw JSON
      </h3>
      <LogDetailsCodeBlock
        code={serialized}
        language="json"
        wrapText={props.wrapRawJson}
        className="max-h-72"
      />
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
