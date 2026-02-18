import * as React from "react";

/** Calls `onEscape` when the Escape key is pressed while `enabled` is true. */
export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onEscape();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, onEscape]);
}
