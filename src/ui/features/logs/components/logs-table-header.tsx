import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { flexRender, type Header, type Table } from "@tanstack/react-table";
import type { LogRow } from "../api/types";
import { getColumnSizeVarName } from "./logs-table-sizing";

function setContainerScrollLock(
  containerRef: React.RefObject<HTMLElement | null> | undefined,
  isLocked: boolean,
): void {
  const element = containerRef?.current;
  if (!element) {
    return;
  }

  element.style.overflow = isLocked ? "hidden" : "";
}

function ColumnResizeHandle(props: { header: Header<LogRow, unknown> }) {
  const { header } = props;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: resize handle uses pointer drag interactions.
    <div
      onDoubleClick={() => header.column.resetSize()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className="absolute inset-y-0 -right-1 z-20 w-[9px] cursor-col-resize select-none touch-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border"
    />
  );
}

function SortableHeaderCell(props: {
  header: Header<LogRow, unknown>;
  isAnyColumnResizing: boolean;
}) {
  const { header, isAnyColumnResizing } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  });

  const style: React.CSSProperties = {
    width: `calc(var(${getColumnSizeVarName(header.column.id)}) * 1px)`,
    // Only apply horizontal translation — ignore scale to prevent stretching
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    transition,
    // Lift the dragged column above siblings
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className="relative shrink-0 border-border/50 first:border-l"
      style={style}
    >
      <div
        {...attributes}
        {...listeners}
        className={`truncate pl-2 pr-1 py-2 touch-none ${
          isAnyColumnResizing
            ? "pointer-events-none cursor-col-resize"
            : "cursor-grab active:cursor-grabbing"
        }`}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
      </div>
      <ColumnResizeHandle header={header} />
    </div>
  );
}

export function LogsTableHeader(props: {
  table: Table<LogRow>;
  columnOrder: string[];
  onColumnReorder?: (newOrder: string[]) => void;
  /** Ref to the scroll container — overflow is locked while dragging to prevent scroll. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}) {
  const isAnyColumnResizing = props.table.getState().columnSizingInfo.isResizingColumn !== false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => {
    return () => setContainerScrollLock(props.scrollContainerRef, false);
  }, [props.scrollContainerRef]);

  const handleDragStart = React.useCallback(() => {
    setContainerScrollLock(props.scrollContainerRef, true);
  }, [props.scrollContainerRef]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setContainerScrollLock(props.scrollContainerRef, false);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = props.columnOrder.indexOf(String(active.id));
      const newIndex = props.columnOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      props.onColumnReorder?.(arrayMove(props.columnOrder, oldIndex, newIndex));
    },
    [props.columnOrder, props.onColumnReorder, props.scrollContainerRef],
  );

  const handleDragCancel = React.useCallback(() => {
    setContainerScrollLock(props.scrollContainerRef, false);
  }, [props.scrollContainerRef]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={props.columnOrder} strategy={horizontalListSortingStrategy}>
        <div
          className="sticky top-0 z-10 flex border-b border-border bg-muted px-3 text-xs font-medium text-muted-foreground"
          style={{ width: `calc(var(--table-width) * 1px)` }}
        >
          {props.table
            .getHeaderGroups()
            .map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <SortableHeaderCell
                  key={header.id}
                  header={header}
                  isAnyColumnResizing={isAnyColumnResizing}
                />
              )),
            )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
