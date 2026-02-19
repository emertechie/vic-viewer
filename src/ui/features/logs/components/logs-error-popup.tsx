import * as React from "react";

export function LogsErrorPopup(props: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const durationMs = props.durationMs ?? 5000;

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      props.onDismiss();
    }, durationMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [durationMs, props.onDismiss]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-md rounded-md border border-destructive/40 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="text-sm text-destructive">{props.message}</p>
    </div>
  );
}
