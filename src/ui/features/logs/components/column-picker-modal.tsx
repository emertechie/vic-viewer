import * as React from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui/components/ui/alert-dialog";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import type { ColumnConfigEntry, LogProfile } from "../api/types";
import type { useColumnConfig } from "../hooks/use-column-config";
import { getDefaultColumns } from "../hooks/use-column-config";
import {
  fieldSelectorsMatch,
  getProfileFieldIdentifier,
  getProfileFieldLabel,
} from "../state/profile-fields";

type ColumnConfigHook = ReturnType<typeof useColumnConfig>;

/** Derive all available fields grouped by fieldSet section from the profile. */
function getAvailableFieldSets(profile: LogProfile): AvailableFieldSet[] {
  const sets: AvailableFieldSet[] = [];

  for (const fieldSet of profile.logDetails.fieldSets) {
    const fields: AvailableField[] = [];

    for (const field of fieldSet.fields) {
      // Skip special auto-expanding types - they aren't meaningful as table columns
      if (field.type === "StructuredLoggingFields" || field.type === "RemainingFields") {
        continue;
      }

      fields.push({
        id: getProfileFieldIdentifier(field),
        title: getProfileFieldLabel(field),
        field: field.field,
        fields: field.fields,
      });
    }

    if (fields.length > 0) {
      sets.push({
        name: fieldSet.name,
        fields,
      });
    }
  }

  return sets;
}

type AvailableField = {
  id: string;
  title: string;
  field?: string;
  fields?: string[];
};

type AvailableFieldSet = {
  name: string;
  fields: AvailableField[];
};

function formatFieldSource(entry: { field?: string; fields?: string[] }): string {
  if (entry.field) return entry.field;
  if (entry.fields && entry.fields.length > 0) return entry.fields.join(" | ");
  return "";
}

// ── LHS: Visible columns with drag-drop reorder ─────────────────────

function VisibleColumnItem(props: {
  column: ColumnConfigEntry;
  index: number;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragTarget: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={() => props.onDragStart(props.index)}
      onDragOver={(e) => {
        e.preventDefault();
        props.onDragOver(props.index);
      }}
      onDragEnd={props.onDragEnd}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs transition-colors ${
        props.isDragTarget ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{props.column.title}</span>
        <span className="ml-1.5 text-muted-foreground">{formatFieldSource(props.column)}</span>
      </div>
      <button
        type="button"
        onClick={() => props.onRemove(props.column.id)}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${props.column.title}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function VisibleColumnsList(props: {
  columns: ColumnConfigEntry[];
  onChange: (columns: ColumnConfigEntry[]) => void;
}) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);

  const handleRemove = React.useCallback(
    (id: string) => {
      props.onChange(props.columns.filter((col) => col.id !== id));
    },
    [props.columns, props.onChange],
  );

  const handleDragStart = React.useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = React.useCallback((index: number) => {
    setDropIndex(index);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const next = [...props.columns];
      const [moved] = next.splice(dragIndex, 1);
      if (moved) {
        next.splice(dropIndex, 0, moved);
        props.onChange(next);
      }
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, props.columns, props.onChange]);

  if (props.columns.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No visible columns. Use the toggles on the right to add columns.
      </p>
    );
  }

  return (
    <div className="space-y-1" onDragOver={(e) => e.preventDefault()}>
      {props.columns.map((col, index) => (
        <VisibleColumnItem
          key={col.id}
          column={col}
          index={index}
          onRemove={handleRemove}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          isDragTarget={dropIndex === index && dragIndex !== index}
        />
      ))}
    </div>
  );
}

// ── RHS: Available fields from profile, grouped by fieldSet ──────────

function AvailableFieldRow(props: {
  field: AvailableField;
  isVisible: boolean;
  onToggle: (field: AvailableField, visible: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-xs">
      <Checkbox
        checked={props.isVisible}
        onCheckedChange={(checked) => props.onToggle(props.field, checked === true)}
        aria-label={`Toggle ${props.field.title}`}
      />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground">{props.field.title}</span>
        <span className="ml-1.5 text-muted-foreground">{formatFieldSource(props.field)}</span>
      </div>
    </label>
  );
}

function AvailableFieldsPanel(props: {
  fieldSets: AvailableFieldSet[];
  customColumns: ColumnConfigEntry[];
  columns: ColumnConfigEntry[];
  onToggle: (field: AvailableField, visible: boolean) => void;
  onAddCustom: (entry: ColumnConfigEntry) => void;
  onDeleteCustom: (id: string) => void;
}) {
  const isFieldVisible = React.useCallback(
    (field: AvailableField) => {
      return props.columns.some((col) => fieldSelectorsMatch(col, field));
    },
    [props.columns],
  );

  return (
    <div className="space-y-3">
      {props.fieldSets.map((fieldSet) => (
        <div key={fieldSet.name}>
          <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {fieldSet.name}
          </h4>
          {fieldSet.fields.map((field) => (
            <AvailableFieldRow
              key={field.id}
              field={field}
              isVisible={isFieldVisible(field)}
              onToggle={props.onToggle}
            />
          ))}
        </div>
      ))}

      {props.customColumns.length > 0 ? (
        <div>
          <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Custom Columns
          </h4>
          {props.customColumns.map((col) => (
            <div key={col.id} className="flex items-center gap-1">
              <div className="flex-1">
                <AvailableFieldRow
                  field={{
                    id: col.id,
                    title: col.title,
                    field: col.field,
                    fields: col.fields,
                  }}
                  isVisible={isFieldVisible(col)}
                  onToggle={props.onToggle}
                />
              </div>
              <button
                type="button"
                onClick={() => props.onDeleteCustom(col.id)}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${col.title}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <CustomColumnForm onAdd={props.onAddCustom} />
    </div>
  );
}

// ── Custom column form ───────────────────────────────────────────────

function CustomColumnForm(props: { onAdd: (entry: ColumnConfigEntry) => void }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [field, setField] = React.useState("");
  const [fallbacks, setFallbacks] = React.useState("");

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedTitle = title.trim();
      const trimmedField = field.trim();
      if (!trimmedTitle || !trimmedField) return;

      const fallbackList = fallbacks
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const allFields = [trimmedField, ...fallbackList];
      const id = `custom-${trimmedField}`;

      const entry: ColumnConfigEntry =
        allFields.length === 1
          ? { id, title: trimmedTitle, field: trimmedField, custom: true }
          : { id, title: trimmedTitle, fields: allFields, custom: true };

      props.onAdd(entry);
      setTitle("");
      setField("");
      setFallbacks("");
      setIsExpanded(false);
    },
    [title, field, fallbacks, props.onAdd],
  );

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        Add custom column
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-border p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          New Custom Column
        </span>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Column title"
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <input
        type="text"
        value={field}
        onChange={(e) => setField(e.target.value)}
        placeholder="Field name (e.g. http.method)"
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <input
        type="text"
        value={fallbacks}
        onChange={(e) => setFallbacks(e.target.value)}
        placeholder="Fallback fields (comma-separated, optional)"
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!title.trim() || !field.trim()}
        className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground transition-opacity disabled:opacity-50"
      >
        Add Column
      </button>
    </form>
  );
}

// ── Main modal ───────────────────────────────────────────────────────

export function ColumnPickerModal(props: {
  profile: LogProfile;
  columnConfig: ColumnConfigHook;
  onClose: () => void;
}) {
  const { profile, columnConfig } = props;

  // Local working copy so changes are immediate but we save on each mutation
  const [localColumns, setLocalColumns] = React.useState<ColumnConfigEntry[]>(columnConfig.columns);

  // Sync local state when server state changes (e.g. from drawer toggle)
  React.useEffect(() => {
    setLocalColumns(columnConfig.columns);
  }, [columnConfig.columns]);

  const availableFieldSets = React.useMemo(() => getAvailableFieldSets(profile), [profile]);

  // Track which custom columns exist (from persisted config, not profile)
  const customColumns = React.useMemo(
    () => localColumns.filter((col) => col.custom),
    [localColumns],
  );

  // All custom columns that have ever been added (visible or not) need to appear in RHS.
  // Since we only store visible columns, hidden custom columns are lost.
  // We track them in a separate set for the modal session.
  const [allCustomColumns, setAllCustomColumns] =
    React.useState<ColumnConfigEntry[]>(customColumns);

  // Merge custom columns from localColumns into allCustomColumns on change
  React.useEffect(() => {
    setAllCustomColumns((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      const merged = [...prev];
      for (const col of localColumns) {
        if (col.custom && !ids.has(col.id)) {
          merged.push(col);
          ids.add(col.id);
        }
      }
      return merged;
    });
  }, [localColumns]);

  const saveColumns = React.useCallback(
    (nextColumns: ColumnConfigEntry[]) => {
      setLocalColumns(nextColumns);
      columnConfig.save({ columns: nextColumns });
    },
    [columnConfig],
  );

  const handleVisibleColumnsChange = React.useCallback(
    (nextColumns: ColumnConfigEntry[]) => {
      saveColumns(nextColumns);
    },
    [saveColumns],
  );

  const handleToggleField = React.useCallback(
    (field: AvailableField, visible: boolean) => {
      if (visible) {
        // Don't add duplicates — match by field selector, not ID
        const existing = localColumns.find((c) => fieldSelectorsMatch(c, field));
        if (existing) return;

        // Check if it's a custom column
        const customMatch = allCustomColumns.find((c) => c.id === field.id);
        const entry: ColumnConfigEntry = customMatch ?? {
          id: field.id,
          title: field.title,
          field: field.field,
          fields: field.fields,
        };
        saveColumns([...localColumns, entry]);
      } else {
        // Remove by field selector match so it works regardless of ID mismatch
        saveColumns(localColumns.filter((c) => !fieldSelectorsMatch(c, field)));
      }
    },
    [localColumns, allCustomColumns, saveColumns],
  );

  const handleAddCustom = React.useCallback(
    (entry: ColumnConfigEntry) => {
      setAllCustomColumns((prev) => [...prev, entry]);
      // Auto-add to visible columns
      saveColumns([...localColumns, entry]);
    },
    [localColumns, saveColumns],
  );

  const handleDeleteCustom = React.useCallback(
    (id: string) => {
      setAllCustomColumns((prev) => prev.filter((c) => c.id !== id));
      // Also remove from visible columns if present
      saveColumns(localColumns.filter((c) => c.id !== id));
    },
    [localColumns, saveColumns],
  );

  const handleReset = React.useCallback(() => {
    const defaults = getDefaultColumns(profile);
    setLocalColumns(defaults);
    setAllCustomColumns([]);
    columnConfig.reset();
  }, [profile, columnConfig]);

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>Configure Columns</DialogTitle>
          <DialogDescription>
            Drag to reorder visible columns. Toggle fields to show or hide them in the table.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* LHS: Visible columns */}
          <div className="flex w-1/2 flex-col overflow-hidden">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visible Columns ({localColumns.length})
            </h3>
            <div className="flex-1 overflow-auto">
              <VisibleColumnsList columns={localColumns} onChange={handleVisibleColumnsChange} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="mt-2 self-start text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                >
                  Reset to default
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset columns?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will discard your column configuration and restore the profile defaults.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {/* RHS: Available fields */}
          <div className="flex w-1/2 flex-col overflow-hidden border-l border-border pl-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available Fields
            </h3>
            <div className="flex-1 overflow-auto">
              <AvailableFieldsPanel
                fieldSets={availableFieldSets}
                customColumns={allCustomColumns}
                columns={localColumns}
                onToggle={handleToggleField}
                onAddCustom={handleAddCustom}
                onDeleteCustom={handleDeleteCustom}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
