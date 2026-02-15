import { describe, expect, it } from "vitest";
import { parseVictoriaLogsQueryResponse } from "../../src/server/vicstack/victoriaLogsClient";

describe("VictoriaLogs query response parsing", () => {
  it("parses JSON payloads", () => {
    const parsed = parseVictoriaLogsQueryResponse(
      JSON.stringify([
        {
          _time: "2026-02-14T19:25:34.66023Z",
          _msg: "hello",
        },
      ]),
    );

    expect(parsed).toEqual([
      {
        _time: "2026-02-14T19:25:34.66023Z",
        _msg: "hello",
      },
    ]);
  });

  it("parses NDJSON payloads", () => {
    const parsed = parseVictoriaLogsQueryResponse(
      '{"_time":"2026-02-14T19:25:34.66023Z","_msg":"line1"}\n{"_time":"2026-02-14T19:25:35.00000Z","_msg":"line2"}',
    );

    expect(parsed).toEqual([
      {
        _time: "2026-02-14T19:25:34.66023Z",
        _msg: "line1",
      },
      {
        _time: "2026-02-14T19:25:35.00000Z",
        _msg: "line2",
      },
    ]);
  });

  it("returns empty array for empty body", () => {
    expect(parseVictoriaLogsQueryResponse("  \n")).toEqual([]);
  });

  it("throws for invalid payloads", () => {
    expect(() => parseVictoriaLogsQueryResponse("not-json\n{bad}")).toThrow(
      /Unable to parse VictoriaLogs response/,
    );
  });
});
