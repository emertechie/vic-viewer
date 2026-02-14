import type { LogsPageInfo, LogRow } from "../api/types";

const defaultPageInfo: LogsPageInfo = {
  hasOlder: false,
  hasNewer: false,
};

export type MergeDirection = "replace" | "prepend" | "append";

export function mergeLogRows(
  existingRows: LogRow[],
  incomingRows: LogRow[],
  direction: MergeDirection,
  maxRows: number,
): LogRow[] {
  if (direction === "replace") {
    return incomingRows.slice(-maxRows);
  }

  const candidateRows =
    direction === "prepend"
      ? [...incomingRows, ...existingRows]
      : [...existingRows, ...incomingRows];

  const seenKeys = new Set<string>();
  const dedupedRows: LogRow[] = [];

  for (const row of candidateRows) {
    if (seenKeys.has(row.key)) {
      continue;
    }

    seenKeys.add(row.key);
    dedupedRows.push(row);
  }

  return dedupedRows.slice(-maxRows);
}

export function mergePageInfo(
  current: LogsPageInfo | null,
  incoming: LogsPageInfo,
  direction: MergeDirection,
): LogsPageInfo {
  if (direction === "replace" || !current) {
    return incoming;
  }

  if (direction === "prepend") {
    return {
      hasOlder: incoming.hasOlder,
      olderCursor: incoming.olderCursor,
      hasNewer: current.hasNewer,
      newerCursor: current.newerCursor,
    };
  }

  return {
    hasOlder: current.hasOlder,
    olderCursor: current.olderCursor,
    hasNewer: incoming.hasNewer,
    newerCursor: incoming.newerCursor,
  };
}

export function getPageInfoOrDefault(pageInfo: LogsPageInfo | null): LogsPageInfo {
  return pageInfo ?? defaultPageInfo;
}
