import * as React from "react";
import { CopyButton } from "@/ui/components/copy-button";
import type { DrawerFieldRow, DrawerFieldSet } from "./log-details-field-sets";
import { LogDetailsCodeBlock } from "./log-details-code-block";

type CopyHandler = (value: string) => Promise<void> | void;

function shouldShowOpenTraceButton(fieldSetName: string): boolean {
  const normalizedName = fieldSetName.toLowerCase();
  return normalizedName.includes("trace") || normalizedName.includes("correlation");
}

function DetailRow(props: { row: DrawerFieldRow; onCopy: CopyHandler }) {
  const displayValue = props.row.value ?? "—";
  const canCopy = Boolean(props.row.value);

  const handleCopyValue = React.useCallback(async () => {
    if (!props.row.value) {
      return;
    }

    await props.onCopy(props.row.value);
  }, [props.onCopy, props.row.value]);

  return (
    <div className="grid grid-cols-[100px_1fr_auto] items-start gap-2 border-b border-border/40 py-1.5 text-xs">
      <span className="text-muted-foreground">{props.row.label}</span>
      {props.row.valueType === "sql" && props.row.value ? (
        <LogDetailsCodeBlock code={props.row.value} language="sql" className="max-h-48" />
      ) : (
        <span className="break-all text-foreground">{displayValue}</span>
      )}
      <CopyButton label={props.row.label} disabled={!canCopy} onCopy={handleCopyValue} />
    </div>
  );
}

export function LogDetailsFieldSetSection(props: {
  fieldSet: DrawerFieldSet;
  traceId: string | null;
  onOpenTrace: (traceId: string) => void;
  onCopy: CopyHandler;
}) {
  const canOpenTrace = shouldShowOpenTraceButton(props.fieldSet.name) && Boolean(props.traceId);

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {props.fieldSet.name}
        </h3>
        {canOpenTrace ? (
          <button
            type="button"
            onClick={() => {
              if (props.traceId) {
                props.onOpenTrace(props.traceId);
              }
            }}
            className="rounded border border-primary/40 px-2 py-0.5 text-[10px] text-primary"
          >
            Open Trace
          </button>
        ) : null}
      </div>
      {props.fieldSet.rows.map((row) => (
        <DetailRow key={row.id} row={row} onCopy={props.onCopy} />
      ))}
    </section>
  );
}
