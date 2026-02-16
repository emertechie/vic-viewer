import { describe, expect, it } from "vitest";
import { createFakeVictoriaLogsClient } from "../../src/server/vicstack/fakeVictoriaLogsClient";

type FakeRawLogRecord = {
  _time?: string;
  _stream_id?: string;
  trace_id?: string;
  span_id?: string;
  _msg?: string;
};

function getRecordSignature(record: FakeRawLogRecord): string | null {
  if (!record._time || !record._stream_id || !record.trace_id || !record.span_id) {
    return null;
  }

  return `${record._time}|${record._stream_id}|${record.trace_id}|${record.span_id}`;
}

function toFakeRawLogRecords(payload: unknown): FakeRawLogRecord[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.filter(
    (value): value is FakeRawLogRecord => typeof value === "object" && value !== null,
  );
}

describe("fake VictoriaLogs client", () => {
  it("keeps sequence markers stable across overlapping windows", async () => {
    const client = createFakeVictoriaLogsClient({
      profile: "steady",
      seed: "fake-sequence-stability",
    });

    const end = Date.now() - 2 * 60 * 1000;
    const startWide = end - 6 * 60 * 60 * 1000;
    const startNarrow = end - 3 * 60 * 60 * 1000;

    const widePayload = await client.queryRaw({
      query: "*",
      start: new Date(startWide).toISOString(),
      end: new Date(end).toISOString(),
      limit: 10_000,
    });
    const narrowPayload = await client.queryRaw({
      query: "*",
      start: new Date(startNarrow).toISOString(),
      end: new Date(end).toISOString(),
      limit: 10_000,
    });

    const wideRows = toFakeRawLogRecords(widePayload);
    const narrowRows = toFakeRawLogRecords(narrowPayload);

    const wideBySignature = new Map<string, string>();
    for (const row of wideRows) {
      const signature = getRecordSignature(row);
      if (!signature || typeof row._msg !== "string") {
        continue;
      }

      wideBySignature.set(signature, row._msg);
    }

    let overlapCount = 0;
    let mismatchedMessages = 0;
    for (const row of narrowRows) {
      const signature = getRecordSignature(row);
      if (!signature || typeof row._msg !== "string") {
        continue;
      }

      const matchingMessage = wideBySignature.get(signature);
      if (!matchingMessage) {
        continue;
      }

      overlapCount += 1;
      if (matchingMessage !== row._msg) {
        mismatchedMessages += 1;
      }
    }

    expect(overlapCount).toBeGreaterThan(0);
    expect(mismatchedMessages).toBe(0);
  });
});
