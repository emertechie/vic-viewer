import * as React from "react";
import { Columns } from "lucide-react";
import { CopyButton } from "@/ui/components/copy-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/ui/tooltip";
import type { ColumnConfigEntry } from "../api/types";
import { fieldSelectorsMatch } from "../state/profile-fields";
import type { QuickFilterOperator, QuickFilterSelector } from "../state/quick-filters";
import type { DrawerFieldRow, DrawerFieldSet } from "./log-details-field-sets";
import { LogDetailsCodeBlock } from "./log-details-code-block";

type CopyHandler = (value: string) => Promise<void> | void;
type ToggleColumnHandler = (
  fieldId: string,
  field?: string,
  fields?: string[],
  title?: string,
) => void;
type QuickFilterHandler = (
  operator: QuickFilterOperator,
  selector: QuickFilterSelector,
  value: string,
) => void;

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
              ? "border-foreground/30 bg-muted text-foreground dark:border-input"
              : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
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

function QuickFilterButton(props: {
  label: "=" | "!=";
  operator: QuickFilterOperator;
  row: DrawerFieldRow;
  disabled: boolean;
  onApplyQuickFilter: QuickFilterHandler;
}) {
  const handleClick = React.useCallback(() => {
    if (!props.row.value) {
      return;
    }

    props.onApplyQuickFilter(
      props.operator,
      {
        field: props.row.field,
        fields: props.row.fields,
      },
      props.row.value,
    );
  }, [props.onApplyQuickFilter, props.operator, props.row]);

  const tooltip = props.operator === "=" ? "Filter for this value" : "Filter out this value";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={props.disabled}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-input px-1 text-[10px] leading-none text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-50"
          aria-label={`${props.row.label} ${props.operator} ${props.row.value ?? ""}`}
        >
          {props.label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function DetailRow(props: {
  row: DrawerFieldRow;
  visibleColumns: ColumnConfigEntry[];
  onCopy: CopyHandler;
  onToggleColumn: ToggleColumnHandler;
  onApplyQuickFilter: QuickFilterHandler;
}) {
  const displayValue = props.row.value ?? "\u2014";
  const canCopy = Boolean(props.row.value);
  const canApplyQuickFilter =
    canCopy &&
    (Boolean(props.row.field) || Boolean(props.row.fields && props.row.fields.length > 0));
  // Match by underlying field selector so IDs from different sources still match
  const isVisible = props.visibleColumns.some((col) => fieldSelectorsMatch(col, props.row));

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
      <div className="flex items-start gap-1">
        <QuickFilterButton
          label="="
          operator="="
          row={props.row}
          disabled={!canApplyQuickFilter}
          onApplyQuickFilter={props.onApplyQuickFilter}
        />
        <QuickFilterButton
          label="!="
          operator="!="
          row={props.row}
          disabled={!canApplyQuickFilter}
          onApplyQuickFilter={props.onApplyQuickFilter}
        />
        <ToggleColumnButton row={props.row} isVisible={isVisible} onToggle={props.onToggleColumn} />
        <CopyButton label={props.row.label} disabled={!canCopy} onCopy={handleCopyValue} />
      </div>
    </div>
  );
}

export function LogDetailsFieldSetSection(props: {
  fieldSet: DrawerFieldSet;
  visibleColumns: ColumnConfigEntry[];
  onCopy: CopyHandler;
  onToggleColumn: ToggleColumnHandler;
  onApplyQuickFilter: QuickFilterHandler;
}) {
  return (
    <section>
      <div className="mb-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {props.fieldSet.name}
        </h3>
      </div>
      {props.fieldSet.rows.map((row) => (
        <DetailRow
          key={row.id}
          row={row}
          visibleColumns={props.visibleColumns}
          onCopy={props.onCopy}
          onToggleColumn={props.onToggleColumn}
          onApplyQuickFilter={props.onApplyQuickFilter}
        />
      ))}
    </section>
  );
}
