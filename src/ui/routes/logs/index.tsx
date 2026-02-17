import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LogRow } from "@/ui/features/logs/api/types";
import { LogDetailsDrawer } from "@/ui/features/logs/components/log-details-drawer";
import { LogsQueryControls } from "@/ui/features/logs/components/logs-query-controls";
import { LogsTable } from "@/ui/features/logs/components/logs-table";
import { useActiveLogProfile } from "@/ui/features/logs/hooks/use-active-log-profile";
import { useLogsViewer } from "@/ui/features/logs/hooks/use-logs-viewer";
import {
  parseLogsSearch,
  refreshRelativeWindow,
  type LogsSearch,
} from "@/ui/features/logs/state/search";

export const Route = createFileRoute("/logs/")({
  validateSearch: (search) => parseLogsSearch(search),
  component: LogsPage,
});

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function getAdjacentRowKey(rows: LogRow[], selectedRowIndex: number, step: -1 | 1): string | null {
  const nextRow = rows[selectedRowIndex + step];
  return nextRow ? nextRow.key : null;
}

function LogsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const viewer = useLogsViewer(search);
  const activeProfile = useActiveLogProfile();
  const isProfileLoading = activeProfile.isLoading && !activeProfile.data;
  const profileErrorMessage = activeProfile.error
    ? activeProfile.error instanceof Error
      ? activeProfile.error.message
      : "Failed to load active log profile"
    : null;
  const selectedRow = React.useMemo(
    () => viewer.rows.find((row) => row.key === search.selected) ?? null,
    [search.selected, viewer.rows],
  );
  const selectedRowIndex = React.useMemo(
    () => viewer.rows.findIndex((row) => row.key === search.selected),
    [search.selected, viewer.rows],
  );

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
      navigate({
        search: (previous) => ({
          ...previous,
          selected: row.key,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const onCloseDrawer = React.useCallback(() => {
    navigate({
      search: (previous) => ({
        ...previous,
        selected: undefined,
      }),
      replace: true,
    });
  }, [navigate]);

  const onSelectRelativeRow = React.useCallback(
    (step: -1 | 1) => {
      const nextRowKey = getAdjacentRowKey(viewer.rows, selectedRowIndex, step);
      if (!nextRowKey) {
        return;
      }

      navigate({
        search: (previous) => ({
          ...previous,
          selected: nextRowKey,
        }),
        replace: true,
      });
    },
    [navigate, selectedRowIndex, viewer.rows],
  );

  React.useEffect(() => {
    if (!search.selected) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      const step: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
      const nextRowKey = getAdjacentRowKey(viewer.rows, selectedRowIndex, step);
      if (!nextRowKey) {
        return;
      }

      event.preventDefault();
      navigate({
        search: (previous) => ({
          ...previous,
          selected: nextRowKey,
        }),
        replace: true,
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate, search.selected, selectedRowIndex, viewer.rows]);

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
          <LogsTable
            rows={viewer.rows}
            pageInfo={viewer.pageInfo}
            activeProfile={activeProfile.data}
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
          canSelectPrevious={selectedRowIndex > 0}
          canSelectNext={selectedRowIndex > -1 && selectedRowIndex < viewer.rows.length - 1}
          onSelectPrevious={() => onSelectRelativeRow(-1)}
          onSelectNext={() => onSelectRelativeRow(1)}
          onClose={onCloseDrawer}
          onOpenTrace={onOpenTrace}
        />
      ) : null}
    </div>
  );
}
