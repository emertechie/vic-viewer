import * as React from "react";
import { Columns } from "lucide-react";
import { CopyButton } from "@/ui/components/copy-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/ui/tooltip";
import type { DrawerFieldRow, DrawerFieldSet } from "./log-details-field-sets";
import { LogDetailsCodeBlock } from "./log-details-code-block";

type CopyHandler = (value: string) => Promise<void> | void;
type ToggleColumnHandler = (
  fieldId: string,
  field?: string,
  fields?: string[],
  title?: string,
) => void;

function shouldShowOpenTraceButton(fieldSetName: string): boolean {
  const normalizedName = fieldSetName.toLowerCase();
  return normalizedName.includes("trace") || normalizedName.includes("correlation");
}

function ToggleColumnButton(props: {
  row: DrawerFieldRow;
  isVisible: boolean;
  onToggle: ToggleColumnHandler;
}) {
  const handleClick = React.useCallback(() => {
    props.onToggle(props.row.id, props.row.field, props.row.fields, props.row.label);
  }, [props.onToggle, props.row]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            props.isVisible
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:text-foreground"
          }`}
          aria-label={
            props.isVisible ? `Hide ${props.row.label} column` : `Show ${props.row.label} as column`
          }
        >
          <Columns className="h-3 w-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {props.isVisible ? "Hide column" : "Show as column"}
      </TooltipContent>
    </Tooltip>
  );
}

function DetailRow(props: {
  row: DrawerFieldRow;
  visibleColumnIds: Set<string>;
  onCopy: CopyHandler;
  onToggleColumn: ToggleColumnHandler;
}) {
  const displayValue = props.row.value ?? "\u2014";
  const canCopy = Boolean(props.row.value);
  const isVisible = props.visibleColumnIds.has(props.row.id);

  const handleCopyValue = React.useCallback(async () => {
    if (!props.row.value) {
      return;
    }

    await props.onCopy(props.row.value);
  }, [props.onCopy, props.row.value]);

  return (
    <div className="grid grid-cols-[100px_1fr_auto_auto] items-start gap-2 border-b border-border/40 py-1.5 text-xs">
      <span className="text-muted-foreground">{props.row.label}</span>
      {props.row.valueType === "sql" && props.row.value ? (
        <LogDetailsCodeBlock code={props.row.value} language="sql" className="max-h-48" />
      ) : (
        <span className="break-all text-foreground">{displayValue}</span>
      )}
      <ToggleColumnButton row={props.row} isVisible={isVisible} onToggle={props.onToggleColumn} />
      <CopyButton label={props.row.label} disabled={!canCopy} onCopy={handleCopyValue} />
    </div>
  );
}

export function LogDetailsFieldSetSection(props: {
  fieldSet: DrawerFieldSet;
  traceId: string | null;
  visibleColumnIds: Set<string>;
  onOpenTrace: (traceId: string) => void;
  onCopy: CopyHandler;
  onToggleColumn: ToggleColumnHandler;
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
        <DetailRow
          key={row.id}
          row={row}
          visibleColumnIds={props.visibleColumnIds}
          onCopy={props.onCopy}
          onToggleColumn={props.onToggleColumn}
        />
      ))}
    </section>
  );
}
