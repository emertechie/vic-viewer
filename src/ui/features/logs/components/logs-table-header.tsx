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
import { GripVertical } from "lucide-react";
import type { LogRow } from "../api/types";

function SortableHeaderCell(props: { header: Header<LogRow, unknown> }) {
  const { header } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: header.id });

  const style: React.CSSProperties = {
    width: header.getSize(),
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="group flex shrink-0 items-center gap-0.5 px-1"
      style={style}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100"
        aria-label={`Drag to reorder ${String(header.column.columnDef.header)}`}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="truncate">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    </div>
  );
}

export function LogsTableHeader(props: {
  table: Table<LogRow>;
  columnOrder: string[];
  onColumnReorder?: (newOrder: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = props.columnOrder.indexOf(String(active.id));
      const newIndex = props.columnOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      props.onColumnReorder?.(arrayMove(props.columnOrder, oldIndex, newIndex));
    },
    [props.columnOrder, props.onColumnReorder],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
