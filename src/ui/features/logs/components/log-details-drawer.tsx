import * as React from "react";
import { CopyButton } from "@/components/copy-button";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useClipboard } from "@/hooks/use-clipboard";
import type { LogRow } from "../api/types";

type CopyHandler = (value: string) => Promise<void> | void;

function parseStreamLabels(stream: string | null): Array<{ key: string; value: string }> {
  if (!stream) {
    return [];
  }

  const labels: Array<{ key: string; value: string }> = [];
  const regex = /([A-Za-z0-9_.-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null = regex.exec(stream);
  while (match) {
    labels.push({
      key: match[1] ?? "",
      value: match[2] ?? "",
    });
    match = regex.exec(stream);
  }

  return labels;
}

function DetailRow(props: { label: string; value: string | null; onCopy?: CopyHandler }) {
  const displayValue = props.value ?? "—";
  const canCopy = Boolean(props.value);

  const handleCopyValue = React.useCallback(async () => {
    if (!props.value || !props.onCopy) {
      return;
    }

    await props.onCopy(props.value);
  }, [props.onCopy, props.value]);

  return (
    <div className="grid grid-cols-[100px_1fr_auto] items-start gap-2 border-b border-border/40 py-1.5 text-xs">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="break-all text-foreground">{displayValue}</span>
      <CopyButton
        label={props.label}
        disabled={!canCopy || !props.onCopy}
        onCopy={handleCopyValue}
      />
    </div>
  );
}

export function LogDetailsDrawer(props: {
  row: LogRow | null;
  selectedKey?: string;
  onClose: () => void;
  onOpenTrace: (traceId: string) => void;
}) {
  const { copyToClipboard } = useClipboard();
  const [wrapRawJson, setWrapRawJson] = React.useState(false);
  const streamLabels = React.useMemo(
    () => parseStreamLabels(props.row?.stream ?? null),
    [props.row?.stream],
  );

  const isOpen = Boolean(props.selectedKey);
  const traceId = props.row?.traceId ?? null;

  return (
    <TooltipProvider>
      {isOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-10 bg-black/20"
          onClick={props.onClose}
        />
      ) : null}
      <aside
        className={`absolute inset-y-0 right-0 z-20 flex w-[500px] max-w-[92vw] flex-col border-l border-border bg-card transition-transform duration-150 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold">Log Details</h2>
            <p className="text-[11px] text-muted-foreground">Select a log row to inspect fields</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-input px-2 py-1 text-xs"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-auto px-3 py-2">
          {props.row ? (
            <div className="space-y-4">
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Core
                </h3>
                <DetailRow label="Time" value={props.row.time} onCopy={copyToClipboard} />
                <DetailRow label="Severity" value={props.row.severity} onCopy={copyToClipboard} />
                <DetailRow label="Service" value={props.row.serviceName} onCopy={copyToClipboard} />
                <DetailRow label="Message" value={props.row.message} onCopy={copyToClipboard} />
                <DetailRow label="StreamId" value={props.row.streamId} onCopy={copyToClipboard} />
              </section>
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Trace / Span
                  </h3>
                  {traceId ? (
                    <button
                      type="button"
                      onClick={() => props.onOpenTrace(traceId)}
                      className="rounded border border-primary/40 px-2 py-0.5 text-[10px] text-primary"
                    >
                      Open Trace
                    </button>
                  ) : null}
                </div>
                <DetailRow label="TraceId" value={props.row.traceId} onCopy={copyToClipboard} />
                <DetailRow label="SpanId" value={props.row.spanId} onCopy={copyToClipboard} />
                <DetailRow
                  label="RequestId"
                  value={
                    typeof props.row.raw.RequestId === "string" ? props.row.raw.RequestId : null
                  }
                  onCopy={copyToClipboard}
                />
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stream Labels
                </h3>
                {streamLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No parsed stream labels.</p>
                ) : (
                  streamLabels.map((label) => (
                    <DetailRow
                      key={label.key}
                      label={label.key}
                      value={label.value}
                      onCopy={copyToClipboard}
                    />
                  ))
                )}
              </section>
              <section>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Raw JSON
                </h3>
                <pre
                  className={`max-h-72 overflow-auto rounded border border-border bg-muted/30 p-2 text-[11px] ${
                    wrapRawJson ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                  }`}
                >
                  {JSON.stringify(props.row.raw, null, 2)}
                </pre>
                <div className="mb-2 mt-2 flex justify-end">
                  <label
                    htmlFor="wrap-raw-json"
                    className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    Wrap text
                    <Switch
                      id="wrap-raw-json"
                      size="sm"
                      checked={wrapRawJson}
                      onCheckedChange={setWrapRawJson}
                    />
                  </label>
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              {props.selectedKey
                ? "Selected log is no longer loaded in the current window."
                : "No log selected."}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
