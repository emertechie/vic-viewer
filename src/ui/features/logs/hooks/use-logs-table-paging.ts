import * as React from "react";

const SCROLL_THRESHOLD_PX = 180;
const BOTTOM_LOCK_THRESHOLD_PX = 24;
const SUPPRESS_PAGING_WINDOW_MS = 400;
const PAGING_NOTICE_TIMEOUT_MS = 1500;

export function useLogsTablePaging(options: {
  rowsLength: number;
  hasOlder: boolean;
  hasNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  fakeSequenceMode: boolean;
  onLoadOlder: () => Promise<void>;
  onLoadNewer: () => Promise<void>;
}) {
  const {
    rowsLength,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    fakeSequenceMode,
    onLoadOlder,
    onLoadNewer,
  } = options;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const isAtBottomRef = React.useRef(true);
  // Programmatic scroll-to-bottom during initial render can fire onScroll and
  // immediately trigger paging. This guard ignores those synthetic events briefly.
  const suppressPagingUntilRef = React.useRef(0);
  const [pagingNotice, setPagingNotice] = React.useState<string | null>(null);
  const previousLoadingStateRef = React.useRef({
    older: false,
    newer: false,
  });
  // Capture row counts at load start so we can compute a delta when that load completes.
  const olderLoadStartRowsRef = React.useRef<number | null>(null);
  const newerLoadStartRowsRef = React.useRef<number | null>(null);

  const loadOlderWithAnchor = React.useCallback(async () => {
    if (!hasOlder || loadingOlder) {
      return;
    }

    const scrollElement = containerRef.current;
    if (!scrollElement) {
      return;
    }

    const previousHeight = scrollElement.scrollHeight;
    const previousTop = scrollElement.scrollTop;
    await onLoadOlder();

    requestAnimationFrame(() => {
      const currentElement = containerRef.current;
      if (!currentElement) {
        return;
      }

      const heightDelta = currentElement.scrollHeight - previousHeight;
      currentElement.scrollTop = previousTop + heightDelta;
    });
  }, [hasOlder, loadingOlder, onLoadOlder]);

  const loadNewer = React.useCallback(async () => {
    if (!hasNewer || loadingNewer) {
      return;
    }

    await onLoadNewer();
  }, [hasNewer, loadingNewer, onLoadNewer]);

  const handleScroll = React.useCallback(async () => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    if (Date.now() < suppressPagingUntilRef.current) {
      return;
    }

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isAtBottomRef.current = distanceToBottom < BOTTOM_LOCK_THRESHOLD_PX;

    if (element.scrollTop < SCROLL_THRESHOLD_PX) {
      await loadOlderWithAnchor();
    }

    if (distanceToBottom < SCROLL_THRESHOLD_PX) {
      await loadNewer();
    }
  }, [loadNewer, loadOlderWithAnchor]);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element || !isAtBottomRef.current || rowsLength === 0) {
      return;
    }

    // If the user was already pinned to the bottom, keep that behavior when fresh rows arrive.
    // We briefly suppress paging triggers because this programmatic scroll can emit onScroll.
    suppressPagingUntilRef.current = Date.now() + SUPPRESS_PAGING_WINDOW_MS;
    element.scrollTop = element.scrollHeight;
  }, [rowsLength]);

  React.useEffect(() => {
    if (!fakeSequenceMode) {
      // Sequence status toasts are only useful for deterministic fake-sequence datasets.
      // Clear any existing notice and keep edge-tracking refs in sync.
      setPagingNotice(null);
      previousLoadingStateRef.current = {
        older: loadingOlder,
        newer: loadingNewer,
      };
      return;
    }

    const previous = previousLoadingStateRef.current;

    // Detect "load just started" edges and snapshot current row count.
    if (!previous.older && loadingOlder) {
      olderLoadStartRowsRef.current = rowsLength;
    }

    if (!previous.newer && loadingNewer) {
      newerLoadStartRowsRef.current = rowsLength;
    }

    // Detect "load just finished" edges, compute row delta, and emit a short-lived notice.
    if (previous.older && !loadingOlder) {
      const startRows = olderLoadStartRowsRef.current;
      if (startRows !== null) {
        const loadedRows = rowsLength - startRows;
        if (loadedRows > 0) {
          setPagingNotice(`Loaded ${loadedRows} older rows`);
        }
      }
      olderLoadStartRowsRef.current = null;
    }

    if (previous.newer && !loadingNewer) {
      const startRows = newerLoadStartRowsRef.current;
      if (startRows !== null) {
        const loadedRows = rowsLength - startRows;
        if (loadedRows > 0) {
          setPagingNotice(`Loaded ${loadedRows} newer rows`);
        }
      }
      newerLoadStartRowsRef.current = null;
    }

    previousLoadingStateRef.current = {
      older: loadingOlder,
      newer: loadingNewer,
    };
  }, [fakeSequenceMode, loadingNewer, loadingOlder, rowsLength]);

  React.useEffect(() => {
    if (!pagingNotice) {
      return;
    }

    // Auto-dismiss the paging notice and clean up when message changes/unmounts.
    const timer = window.setTimeout(() => {
      setPagingNotice(null);
    }, PAGING_NOTICE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pagingNotice]);

  return {
    containerRef,
    handleScroll,
    pagingNotice,
  };
}
