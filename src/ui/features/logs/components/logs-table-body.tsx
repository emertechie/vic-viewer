import * as React from "react";
import { flexRender, type RowModel } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { extractLogSequence } from "../../../../shared/logs/sequence";
import type { LogProfile, LogRow } from "../api/types";
import { resolveCoreFieldDisplayText } from "../state/profile-fields";

const FAKE_SEQUENCE_SAMPLE_SIZE = 20;

type SequenceCheckStatus = "pass_full" | "pass_partial" | "fail" | "none";

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
    ? extractLogSequence(resolveMessageForRow(rows[index - 1] as LogRow, activeProfile))
    : null;
  const belowSequence = hasBelow
    ? extractLogSequence(resolveMessageForRow(rows[index + 1] as LogRow, activeProfile))
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

/**
 * Inner body content extracted so it can be memoized during column resizing.
 * During resize, only CSS variables change (applied to the parent), so the
 * body DOM doesn't need to re-render.
 */
const LogsTableBodyInner = React.memo(function LogsTableBodyInner(props: {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rowModel: RowModel<LogRow>;
  rows: LogRow[];
  activeProfile: LogProfile;
  fakeSequenceMode: boolean;
  selectedRowKey?: string;
  onSelectRow?: (row: LogRow) => void;
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

        const rowCells = row.getVisibleCells().map((cell) => (
          <div
            key={cell.id}
            className="shrink-0 self-center truncate px-1 text-foreground/90"
            style={{ width: `calc(var(--col-${cell.column.id}-size) * 1px)` }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ));

        if (props.onSelectRow) {
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => props.onSelectRow?.(row.original)}
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
});

export function LogsTableBody(props: {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  rowModel: RowModel<LogRow>;
  rows: LogRow[];
  activeProfile: LogProfile;
  fakeSequenceMode: boolean;
  selectedRowKey?: string;
  onSelectRow?: (row: LogRow) => void;
  /** True while a column resize drag is in progress — used to skip re-renders. */
  isResizing: boolean;
}) {
  return (
    <LogsTableBodyInner
      virtualizer={props.virtualizer}
      rowModel={props.rowModel}
      rows={props.rows}
      activeProfile={props.activeProfile}
      fakeSequenceMode={props.fakeSequenceMode}
      selectedRowKey={props.selectedRowKey}
      onSelectRow={props.onSelectRow}
    />
  );
}
