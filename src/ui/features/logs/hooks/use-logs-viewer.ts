import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogsQuery } from "../api/client";
import type { LogsPageInfo, LogRow } from "../api/types";
import { mergeLogRows, mergePageInfo } from "../state/paging";
import type { LogsSearch } from "../state/search";

const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_ROWS = 2_000;

export type UseLogsViewerState = {
  rows: LogRow[];
  pageInfo: LogsPageInfo | null;
  isLoadingInitial: boolean;
  isRefreshing: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  errorMessage: string | null;
  loadOlder: () => Promise<void>;
  loadNewer: () => Promise<void>;
};

export function useLogsViewer(
  search: LogsSearch,
  options: { limit?: number; maxRows?: number } = {},
): UseLogsViewerState {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const [rows, setRows] = React.useState<LogRow[]>([]);
  const [pageInfo, setPageInfo] = React.useState<LogsPageInfo | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [loadingNewer, setLoadingNewer] = React.useState(false);

  const initialQuery = useQuery({
    queryKey: ["logs-query", search.q, search.start, search.end, limit],
    queryFn: () =>
      fetchLogsQuery({
        query: search.q,
        start: search.start,
        end: search.end,
        limit,
      }),
    retry: 1,
  });

  React.useEffect(() => {
    if (!initialQuery.data) {
      return;
    }

    setRows((previousRows) =>
      mergeLogRows(previousRows, initialQuery.data.rows, "replace", maxRows),
    );
    setPageInfo(initialQuery.data.pageInfo);
    setErrorMessage(null);
  }, [initialQuery.data, maxRows]);

  React.useEffect(() => {
    if (!initialQuery.error) {
      return;
    }

    setErrorMessage(
      initialQuery.error instanceof Error ? initialQuery.error.message : "Failed to load logs",
    );
  }, [initialQuery.error]);

  const loadOlder = React.useCallback(async () => {
    const cursor = pageInfo?.olderCursor;
    if (!cursor || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    try {
      const result = await fetchLogsQuery({
        query: search.q,
        start: search.start,
        end: search.end,
        limit,
        cursor,
      });

      setRows((existingRows) => mergeLogRows(existingRows, result.rows, "prepend", maxRows));
      setPageInfo((existingPageInfo) =>
        mergePageInfo(existingPageInfo, result.pageInfo, "prepend"),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load older logs");
    } finally {
      setLoadingOlder(false);
    }
  }, [limit, loadingOlder, maxRows, pageInfo?.olderCursor, search.end, search.q, search.start]);

  const loadNewer = React.useCallback(async () => {
    const cursor = pageInfo?.newerCursor;
    if (!cursor || loadingNewer) {
      return;
    }

    setLoadingNewer(true);
    try {
      const result = await fetchLogsQuery({
        query: search.q,
        start: search.start,
        end: search.end,
        limit,
        cursor,
      });

      setRows((existingRows) => mergeLogRows(existingRows, result.rows, "append", maxRows));
      setPageInfo((existingPageInfo) => mergePageInfo(existingPageInfo, result.pageInfo, "append"));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load newer logs");
    } finally {
      setLoadingNewer(false);
    }
  }, [limit, loadingNewer, maxRows, pageInfo?.newerCursor, search.end, search.q, search.start]);

  return {
    rows,
    pageInfo,
    isLoadingInitial: initialQuery.isLoading && rows.length === 0,
    isRefreshing: initialQuery.isFetching && rows.length > 0,
    loadingOlder,
    loadingNewer,
    errorMessage,
    loadOlder,
    loadNewer,
  };
}
