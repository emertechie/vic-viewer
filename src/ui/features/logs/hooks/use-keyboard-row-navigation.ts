import * as React from "react";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function useKeyboardRowNavigation(options: {
  enabled: boolean;
  canSelectPrevious: boolean;
  canSelectNext: boolean;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
}) {
  const { enabled, canSelectPrevious, canSelectNext, onSelectPrevious, onSelectNext } = options;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowUp") {
        if (!canSelectPrevious) {
          return;
        }

        event.preventDefault();
        onSelectPrevious();
        return;
      }

      if (!canSelectNext) {
        return;
      }

      event.preventDefault();
      onSelectNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canSelectNext, canSelectPrevious, enabled, onSelectNext, onSelectPrevious]);
}
