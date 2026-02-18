import * as React from "react";
import { flexRender, type RowModel } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { extractLogSequence } from "../../../../shared/logs/sequence";
import type { LogProfile, LogRow } from "../api/types";
import { resolveCoreFieldDisplayText, resolveFieldDisplayText } from "../state/profile-fields";
import type { QuickFilterOperator, QuickFilterSelector } from "../state/quick-filters";
import { getColumnSizeVarName } from "./logs-table-sizing";

const FAKE_SEQUENCE_SAMPLE_SIZE = 20;

type SequenceCheckStatus = "pass_full" | "pass_partial" | "fail" | "none";

type QuickFilterHandler = (
  operator: QuickFilterOperator,
  selector: QuickFilterSelector,
  value: string,
) => void;

function CellQuickFilterButton(props: {
  label: "=" | "!=";
  operator: QuickFilterOperator;
  selector: QuickFilterSelector;
  value: string;
  onApplyQuickFilter: QuickFilterHandler;
}) {
  const { onApplyQuickFilter, operator, selector, value } = props;

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onApplyQuickFilter(operator, selector, value);
    },
    [onApplyQuickFilter, operator, selector, value],
  );

  const onMouseDown = React.useCallback((event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <span
      onClick={onClick}
      onMouseDown={onMouseDown}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-input px-1 text-[10px] leading-none text-muted-foreground transition-colors hover:text-foreground"
      aria-hidden
    >
      {props.label}
    </span>
  );
}

type ColumnQuickFilterMeta = {
  field?: string;
  fields?: string[];
};

function hasFieldSelector(field?: string, fields?: string[]): boolean {
  return Boolean(field) || Boolean(fields && fields.length > 0);
}

function resolveMessageForRow(row: LogRow, activeProfile: LogProfile): string {
  return (
    resolveCoreFieldDisplayText({
      record: row.raw,
      profile: activeProfile,
      coreField: "message",
    }) ?? ""
  );
}

function getSequenceCheckStatus(
  rows: LogRow[],
  index: number,
  activeProfile: LogProfile,
): SequenceCheckStatus {
  const current = rows[index];
  if (!current) {
    return "none";
  }

  const hasAbove = index > 0;
  const hasBelow = index < rows.length - 1;
  if (!hasAbove && !hasBelow) {
    return "none";
  }

  const currentSequence = extractLogSequence(resolveMessageForRow(current, activeProfile));
  const aboveSequence = hasAbove
    ? extractLogSequence(resolveMessageForRow(rows[index - 1]!, activeProfile))
    : null;
  const belowSequence = hasBelow
    ? extractLogSequence(resolveMessageForRow(rows[index + 1]!, activeProfile))
    : null;

  if (
    hasAbove &&
    (currentSequence === null || aboveSequence === null || aboveSequence !== currentSequence - 1)
  ) {
    return "fail";
  }

  if (
    hasBelow &&
    (currentSequence === null || belowSequence === null || belowSequence !== currentSequence + 1)
  ) {
    return "fail";
  }

  return hasAbove && hasBelow ? "pass_full" : "pass_partial";
}

function getSequenceRowClasses(status: SequenceCheckStatus): string {
  if (status === "pass_full") {
    return "bg-emerald-500/15 hover:bg-emerald-500/20";
  }

  if (status === "pass_partial") {
    return "bg-sky-500/15 hover:bg-sky-500/20";
  }

  if (status === "fail") {
    return "bg-rose-500/15 hover:bg-rose-500/20";
  }

  return "hover:bg-muted/40";
}

function buildRowClassName(options: {
  sequenceStatus: SequenceCheckStatus;
  isSelected: boolean;
  isSelectable: boolean;
}): string {
  const classNames = [
    "absolute left-0 flex border-b border-border/60 px-3 text-xs",
    getSequenceRowClasses(options.sequenceStatus),
  ];

  if (options.isSelected) {
    classNames.push("ring-1 ring-inset ring-primary/60");
  }

  if (options.isSelectable) {
    classNames.push("cursor-pointer");
  }

  return classNames.join(" ");
}

export function isFakeSequenceMode(rows: LogRow[], activeProfile: LogProfile): boolean {
  const sample = rows.slice(0, FAKE_SEQUENCE_SAMPLE_SIZE);
  if (sample.length === 0) {
    return false;
  }

  return sample.every(
    (row) => extractLogSequence(resolveMessageForRow(row, activeProfile)) !== null,
  );
}

export function LogsTableBody(props: {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rowModel: RowModel<LogRow>;
  rows: LogRow[];
  activeProfile: LogProfile;
  fakeSequenceMode: boolean;
  selectedRowKey?: string;
  onSelectRow?: (row: LogRow) => void;
  onApplyQuickFilter: QuickFilterHandler;
}) {
  return (
    <div className="relative" style={{ height: props.virtualizer.getTotalSize() }}>
      {props.virtualizer.getVirtualItems().map((virtualRow) => {
        const row = props.rowModel.rows[virtualRow.index];
        if (!row) {
          return null;
        }

        const sequenceStatus = props.fakeSequenceMode
          ? getSequenceCheckStatus(props.rows, virtualRow.index, props.activeProfile)
          : "none";
        const rowClassName = buildRowClassName({
          sequenceStatus,
          isSelected: props.selectedRowKey === row.id,
          isSelectable: Boolean(props.onSelectRow),
        });
        const rowStyle: React.CSSProperties = {
          top: 0,
          transform: `translateY(${virtualRow.start}px)`,
          height: `${virtualRow.size}px`,
          width: `calc(var(--table-width) * 1px)`,
        };
        const onSelectRow = props.onSelectRow;

        const rowCells = row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta as ColumnQuickFilterMeta | undefined;
          const field = meta?.field;
          const fields = meta?.fields;
          const hasSelector = hasFieldSelector(field, fields);
          const value = hasSelector
            ? resolveFieldDisplayText(row.original.raw, {
                field,
                fields,
              })
            : null;
          const canApplyQuickFilter = Boolean(value) && hasSelector;

          return (
            <div
              key={cell.id}
              className="group/cell relative shrink-0 self-stretch px-1 text-foreground/90"
              style={{ width: `calc(var(${getColumnSizeVarName(cell.column.id)}) * 1px)` }}
            >
              <div className="flex h-full items-center">
                <span className="block w-full truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </span>
              </div>
              {canApplyQuickFilter && value ? (
                <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity duration-150 group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 group-focus-within/cell:pointer-events-auto group-focus-within/cell:opacity-100">
                  <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/65 p-1 shadow-sm backdrop-blur-sm">
                    <CellQuickFilterButton
                      label="="
                      operator="="
                      selector={{ field, fields }}
                      value={value}
                      onApplyQuickFilter={props.onApplyQuickFilter}
                    />
                    <CellQuickFilterButton
                      label="!="
                      operator="!="
                      selector={{ field, fields }}
                      value={value}
                      onApplyQuickFilter={props.onApplyQuickFilter}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        });

        if (onSelectRow) {
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectRow(row.original)}
              className={`appearance-none text-left ${rowClassName}`}
              style={rowStyle}
            >
              {rowCells}
            </button>
          );
        }

        return (
          <div key={row.id} className={rowClassName} style={rowStyle}>
            {rowCells}
          </div>
        );
      })}
    </div>
  );
}
