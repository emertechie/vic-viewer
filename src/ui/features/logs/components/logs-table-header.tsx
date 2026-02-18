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
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type Header, type Table } from "@tanstack/react-table";
import type { LogRow } from "../api/types";

function SortableHeaderCell(props: { header: Header<LogRow, unknown> }) {
  const { header } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  });

  const style: React.CSSProperties = {
    width: header.getSize(),
    // Only apply horizontal translation — ignore scale to prevent stretching
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    transition,
    // Lift the dragged column above siblings
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="shrink-0 cursor-grab truncate px-1 touch-none active:cursor-grabbing"
      style={style}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = React.useCallback(() => {
    const el = props.scrollContainerRef?.current;
    if (el) el.style.overflow = "hidden";
  }, [props.scrollContainerRef]);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      // Restore scroll on the container
      const el = props.scrollContainerRef?.current;
      if (el) el.style.overflow = "";

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
    const el = props.scrollContainerRef?.current;
    if (el) el.style.overflow = "";
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
          className="sticky top-0 z-10 flex border-b border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
          style={{ width: "100%" }}
        >
          {props.table
            .getHeaderGroups()
            .map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <SortableHeaderCell key={header.id} header={header} />
              )),
            )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
