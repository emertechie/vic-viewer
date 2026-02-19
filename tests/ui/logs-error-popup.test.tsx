import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogsErrorPopup } from "../../src/ui/features/logs/components/logs-error-popup";

describe("logs error popup", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  it("dismisses itself after the configured timeout", () => {
    const onDismiss = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <LogsErrorPopup
          message="VictoriaLogs returned an invalid logs payload"
          durationMs={2000}
          onDismiss={onDismiss}
        />,
      );
    });

    expect(container.textContent).toContain("invalid logs payload");
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
