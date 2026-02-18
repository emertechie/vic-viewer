import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LogRow } from "@/ui/features/logs/api/types";
import type { ColumnConfigEntry } from "@/ui/features/logs/api/types";
import { LogDetailsDrawer } from "@/ui/features/logs/components/log-details-drawer";
import { LogsQueryControls } from "@/ui/features/logs/components/logs-query-controls";
import { LogsTable } from "@/ui/features/logs/components/logs-table";
import { useActiveLogProfile } from "@/ui/features/logs/hooks/use-active-log-profile";
import { useColumnConfig } from "@/ui/features/logs/hooks/use-column-config";
import { useKeyboardRowNavigation } from "@/ui/features/logs/hooks/use-keyboard-row-navigation";
import { useLogsViewer } from "@/ui/features/logs/hooks/use-logs-viewer";
import { fieldSelectorsMatch } from "@/ui/features/logs/state/profile-fields";
import {
  parseLogsSearch,
  refreshRelativeWindow,
  type LogsSearch,
} from "@/ui/features/logs/state/search";

export const Route = createFileRoute("/logs/")({
  validateSearch: (search) => parseLogsSearch(search),
  component: LogsPage,
});

function getAdjacentRowKey(rows: LogRow[], selectedRowIndex: number, step: -1 | 1): string | null {
  const nextRow = rows[selectedRowIndex + step];
  return nextRow ? nextRow.key : null;
}

function LogsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const viewer = useLogsViewer(search);
  const activeProfile = useActiveLogProfile();
  const columnConfig = useColumnConfig(activeProfile.data);
  const [columnPickerOpen, setColumnPickerOpen] = React.useState(false);
  const isProfileLoading = activeProfile.isLoading && !activeProfile.data;
  const profileErrorMessage = activeProfile.error
    ? activeProfile.error instanceof Error
      ? activeProfile.error.message
      : "Failed to load active log profile"
    : null;
  const selectedRowState = React.useMemo(() => {
    const index = viewer.rows.findIndex((row) => row.key === search.selected);
    return {
      row: index > -1 ? viewer.rows[index] : null,
      index,
    };
  }, [search.selected, viewer.rows]);
  const selectedRow = selectedRowState.row;
  const selectedRowIndex = selectedRowState.index;

  const setSelectedRow = React.useCallback(
    (selectedKey: string | undefined) => {
      navigate({
        search: (previous) => ({
          ...previous,
          selected: selectedKey,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const canSelectPrevious = selectedRowIndex > 0;
  const canSelectNext = selectedRowIndex > -1 && selectedRowIndex < viewer.rows.length - 1;

  const onSelectRelativeRow = React.useCallback(
    (step: -1 | 1) => {
      const nextRowKey = getAdjacentRowKey(viewer.rows, selectedRowIndex, step);
      if (!nextRowKey) {
        return;
      }

      setSelectedRow(nextRowKey);
    },
    [selectedRowIndex, setSelectedRow, viewer.rows],
  );

  const onSelectPrevious = React.useCallback(() => {
    onSelectRelativeRow(-1);
  }, [onSelectRelativeRow]);

  const onSelectNext = React.useCallback(() => {
    onSelectRelativeRow(1);
  }, [onSelectRelativeRow]);

  useKeyboardRowNavigation({
    enabled: Boolean(search.selected),
    canSelectPrevious,
    canSelectNext,
    onSelectPrevious,
    onSelectNext,
  });

  const onApplySearch = React.useCallback(
    (nextSearch: LogsSearch) => {
      navigate({
        search: () => ({
          ...nextSearch,
          selected: undefined,
        }),
      });
    },
    [navigate],
  );

  const onToggleLive = React.useCallback(
    (liveMode: "0" | "1") => {
      const nextSearch =
        liveMode === "1"
          ? refreshRelativeWindow({ ...search, live: liveMode }, new Date())
          : { ...search, live: liveMode };

      navigate({
        search: () => nextSearch,
        replace: true,
      });
    },
    [navigate, search],
  );

  React.useEffect(() => {
    if (search.live !== "1" || search.range === "absolute") {
      return;
    }

    const intervalId = window.setInterval(() => {
      const refreshed = refreshRelativeWindow(search, new Date());
      navigate({
        search: () => refreshed,
        replace: true,
      });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [navigate, search]);

  const onSelectRow = React.useCallback(
    (row: LogRow) => {
      setSelectedRow(row.key);
    },
    [setSelectedRow],
  );

  const onCloseDrawer = React.useCallback(() => {
    setSelectedRow(undefined);
  }, [setSelectedRow]);

  const onOpenTrace = React.useCallback(
    (traceId: string) => {
      navigate({
        to: "/traces",
        search: () => ({
          traceId,
        }),
      });
    },
    [navigate],
  );

  const onToggleColumnVisibility = React.useCallback(
    (fieldId: string, field?: string, fields?: string[], title?: string) => {
      const currentColumns = columnConfig.columns;
      const selector = { field, fields };
      const isVisible = currentColumns.some((col) => fieldSelectorsMatch(col, selector));

      if (isVisible) {
        columnConfig.save({
          columns: currentColumns.filter((col) => !fieldSelectorsMatch(col, selector)),
        });
      } else {
        const newEntry: ColumnConfigEntry = {
          id: fieldId,
          title: title ?? fieldId,
          ...(field ? { field } : {}),
          ...(fields ? { fields } : {}),
        };
        columnConfig.save({
          columns: [...currentColumns, newEntry],
        });
      }
    },
    [columnConfig],
  );

  return (
    <div className="relative flex h-full flex-col">
      <LogsQueryControls
        search={search}
        onApplySearch={onApplySearch}
        onToggleLive={onToggleLive}
      />
      <div className="flex-1 overflow-hidden">
        {isProfileLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading log profile...
          </div>
        ) : profileErrorMessage ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-destructive">{profileErrorMessage}</p>
            <button
              type="button"
              onClick={() => void activeProfile.refetch()}
              className="rounded border border-input px-3 py-1.5 text-xs text-foreground"
            >
              Retry
            </button>
          </div>
        ) : activeProfile.data ? (
          <div className="flex h-full flex-col">
            <LogsTableToolbar onOpenColumnPicker={() => setColumnPickerOpen(true)} />
            <div className="flex-1 overflow-hidden">
              <LogsTable
                rows={viewer.rows}
                pageInfo={viewer.pageInfo}
                activeProfile={activeProfile.data}
                visibleColumns={columnConfig.columns}
                selectedRowKey={search.selected}
                loadingOlder={viewer.loadingOlder}
                loadingNewer={viewer.loadingNewer}
                isLoadingInitial={viewer.isLoadingInitial}
                isRefreshing={viewer.isRefreshing}
                errorMessage={viewer.errorMessage}
                onLoadOlder={viewer.loadOlder}
                onLoadNewer={viewer.loadNewer}
                onSelectRow={onSelectRow}
              />
            </div>
            {columnPickerOpen ? (
              <ColumnPickerModal
                profile={activeProfile.data}
                columnConfig={columnConfig}
                onClose={() => setColumnPickerOpen(false)}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No active log profile available.
          </div>
        )}
      </div>
      {activeProfile.data ? (
        <LogDetailsDrawer
          selectedKey={search.selected}
          row={selectedRow}
          activeProfile={activeProfile.data}
          visibleColumns={columnConfig.columns}
          canSelectPrevious={canSelectPrevious}
          canSelectNext={canSelectNext}
          onSelectPrevious={onSelectPrevious}
          onSelectNext={onSelectNext}
          onClose={onCloseDrawer}
          onOpenTrace={onOpenTrace}
          onToggleColumn={onToggleColumnVisibility}
        />
      ) : null}
    </div>
  );
}

/** Small toolbar row above the table with the "Columns" button. */
function LogsTableToolbar(props: { onOpenColumnPicker: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
      <button
        type="button"
        onClick={props.onOpenColumnPicker}
        className="inline-flex items-center gap-1.5 rounded border border-input px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="18" rx="1" />
        </svg>
        Columns
      </button>
    </div>
  );
}

// Lazy-import placeholder - the actual ColumnPickerModal is defined in its own file.
// We import it here so the route doesn't need to know about internals.
import { ColumnPickerModal } from "@/ui/features/logs/components/column-picker-modal";
