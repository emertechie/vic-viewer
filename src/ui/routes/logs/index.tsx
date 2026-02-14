import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogsQueryControls } from "@/features/logs/components/logs-query-controls";
import { LogsTable } from "@/features/logs/components/logs-table";
import { useLogsViewer } from "@/features/logs/hooks/use-logs-viewer";
import {
  parseLogsSearch,
  refreshRelativeWindow,
  type LogsSearch,
} from "@/features/logs/state/search";

export const Route = createFileRoute("/logs/")({
  validateSearch: (search) => parseLogsSearch(search),
  component: LogsPage,
});

function LogsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const viewer = useLogsViewer(search);

  const onApplySearch = React.useCallback(
    (nextSearch: LogsSearch) => {
      navigate({
        search: () => nextSearch,
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

  return (
    <div className="flex h-full flex-col">
      <LogsQueryControls
        search={search}
        onApplySearch={onApplySearch}
        onToggleLive={onToggleLive}
      />
      <div className="flex-1 overflow-hidden">
        <LogsTable
          rows={viewer.rows}
          pageInfo={viewer.pageInfo}
          loadingOlder={viewer.loadingOlder}
          loadingNewer={viewer.loadingNewer}
          isLoadingInitial={viewer.isLoadingInitial}
          isRefreshing={viewer.isRefreshing}
          errorMessage={viewer.errorMessage}
          onLoadOlder={viewer.loadOlder}
          onLoadNewer={viewer.loadNewer}
        />
      </div>
    </div>
  );
}
