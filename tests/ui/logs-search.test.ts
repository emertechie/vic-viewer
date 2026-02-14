import { describe, expect, it } from "vitest";
import { parseLogsSearch, refreshRelativeWindow } from "../../src/ui/features/logs/state/search";

describe("logs search state parsing", () => {
  it("applies defaults including q=* and live=1", () => {
    const now = new Date("2026-02-14T20:00:00.000Z");
    const parsed = parseLogsSearch({}, now);

    expect(parsed.q).toBe("*");
    expect(parsed.live).toBe("1");
    expect(parsed.range).toBe("15m");
    expect(parsed.start).toBe("2026-02-14T19:45:00.000Z");
    expect(parsed.end).toBe("2026-02-14T20:00:00.000Z");
  });

  it("keeps explicit absolute ranges", () => {
    const parsed = parseLogsSearch(
      {
        q: "service.name:api",
        range: "absolute",
        start: "2026-02-14T19:00:00.000Z",
        end: "2026-02-14T19:30:00.000Z",
        live: "0",
      },
      new Date("2026-02-14T20:00:00.000Z"),
    );

    expect(parsed).toMatchObject({
      q: "service.name:api",
      range: "absolute",
      start: "2026-02-14T19:00:00.000Z",
      end: "2026-02-14T19:30:00.000Z",
      live: "0",
    });
  });

  it("refreshes relative windows", () => {
    const initial = parseLogsSearch(
      {
        range: "5m",
      },
      new Date("2026-02-14T20:00:00.000Z"),
    );
    const refreshed = refreshRelativeWindow(initial, new Date("2026-02-14T20:10:00.000Z"));

    expect(refreshed.start).toBe("2026-02-14T20:05:00.000Z");
    expect(refreshed.end).toBe("2026-02-14T20:10:00.000Z");
  });
});
