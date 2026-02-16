import { describe, expect, it } from "vitest";
import {
  getPageInfoOrDefault,
  mergeLogRows,
  mergePageInfo,
} from "../../src/ui/features/logs/state/paging";
import type { LogRow } from "../../src/ui/features/logs/api/types";

function makeRow(key: string, time: string): LogRow {
  return {
    key,
    time,
    tieBreaker: `${key}-tie`,
    message: key,
    streamId: "s1",
    stream: null,
    severity: null,
    serviceName: null,
    traceId: null,
    spanId: null,
    raw: {},
  };
}

describe("logs paging state", () => {
  it("dedupes rows during append merge", () => {
    const existing = [
      makeRow("a", "2026-02-14T19:00:00.000Z"),
      makeRow("b", "2026-02-14T19:01:00.000Z"),
    ];
    const incoming = [
      makeRow("b", "2026-02-14T19:01:00.000Z"),
      makeRow("c", "2026-02-14T19:02:00.000Z"),
    ];

    const merged = mergeLogRows(existing, incoming, "append", 10);
    expect(merged.map((row) => row.key)).toEqual(["a", "b", "c"]);
  });

  it("keeps bounded rows by cap", () => {
    const existing = [
      makeRow("a", "2026-02-14T19:00:00.000Z"),
      makeRow("b", "2026-02-14T19:01:00.000Z"),
    ];
    const incoming = [
      makeRow("c", "2026-02-14T19:02:00.000Z"),
      makeRow("d", "2026-02-14T19:03:00.000Z"),
    ];

    const merged = mergeLogRows(existing, incoming, "append", 3);
    expect(merged.map((row) => row.key)).toEqual(["b", "c", "d"]);
  });

  it("preserves opposite-direction cursor when merging page info", () => {
    const current = {
      hasOlder: true,
      olderCursor: "older-1",
      hasNewer: true,
      newerCursor: "newer-1",
    };
    const olderResult = {
      hasOlder: false,
      hasNewer: true,
      newerCursor: "ignored-newer",
    };
    const newerResult = {
      hasOlder: true,
      olderCursor: "ignored-older",
      hasNewer: false,
    };

    const mergedOlder = mergePageInfo(current, olderResult, "prepend");
    expect(mergedOlder).toMatchObject({
      hasOlder: false,
      olderCursor: undefined,
      hasNewer: true,
      newerCursor: "newer-1",
    });

    const mergedNewer = mergePageInfo(current, newerResult, "append");
    expect(mergedNewer).toMatchObject({
      hasOlder: true,
      olderCursor: "older-1",
      hasNewer: false,
      newerCursor: undefined,
    });
  });

  it("returns default page info when no value is present", () => {
    expect(getPageInfoOrDefault(null)).toEqual({
      hasOlder: false,
      hasNewer: false,
    });
  });
});
