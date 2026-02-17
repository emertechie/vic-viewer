import * as React from "react";
import { CopyButton } from "@/components/copy-button";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useClipboard } from "@/hooks/use-clipboard";
import type { LogProfile, LogRow } from "../api/types";
import {
  fieldNameToTitle,
  getProfileFieldIdentifier,
  getProfileFieldLabel,
  resolveCoreFieldDisplayText,
  resolveFieldMatch,
  toDisplayText,
} from "../state/profile-fields";

type CopyHandler = (value: string) => Promise<void> | void;
type DrawerFieldRow = { id: string; label: string; value: string | null };
type DrawerFieldSet = { id: string; name: string; rows: DrawerFieldRow[] };

function parseOriginalFormatTokens(originalFormat: string): string[] {
  const tokenSet = new Set<string>();
  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(originalFormat);
  while (match) {
    const token = match[1]?.trim();
    if (token) {
      tokenSet.add(token);
    }
    match = regex.exec(originalFormat);
  }

  return [...tokenSet].sort((left, right) => left.localeCompare(right));
}

function buildDefaultFieldSets(row: LogRow): DrawerFieldSet[] {
  const resolve = (field: string) => toDisplayText(row.raw[field]);

  return [
    {
      id: "core",
      name: "Core",
      rows: [
        { id: "time", label: "Time", value: row.time },
        { id: "severity", label: "Severity", value: resolve("severity") },
        { id: "service", label: "Service", value: resolve("service.name") },
        { id: "message", label: "Message", value: resolve("_msg") },
        { id: "stream-id", label: "StreamId", value: resolve("_stream_id") },
      ],
    },
    {
      id: "trace-span",
      name: "Trace / Span",
      rows: [
        {
          id: "trace-id",
          label: "TraceId",
          value: resolve("trace_id") ?? resolve("TraceId"),
        },
        { id: "span-id", label: "SpanId", value: resolve("span_id") ?? resolve("SpanId") },
        {
          id: "request-id",
          label: "RequestId",
          value: typeof row.raw.RequestId === "string" ? row.raw.RequestId : null,
        },
      ],
    },
  ];
}

function buildProfileFieldSets(row: LogRow, profile: LogProfile): DrawerFieldSet[] {
  const renderedKeys = new Set<string>();
  const sets: DrawerFieldSet[] = [];

  for (const [fieldSetIndex, fieldSet] of profile.logDetails.fieldSets.entries()) {
    const rows: DrawerFieldRow[] = [];

    for (const [fieldIndex, field] of fieldSet.fields.entries()) {
      if (field.type === "StructuredLoggingFields") {
        const originalFormatMatch = resolveFieldMatch(row.raw, { field: "{OriginalFormat}" });
        const originalFormatText = originalFormatMatch
          ? toDisplayText(originalFormatMatch.value)
          : null;
        if (!originalFormatText) {
          continue;
        }

        for (const token of parseOriginalFormatTokens(originalFormatText)) {
          if (renderedKeys.has(token)) {
            continue;
          }

          const tokenMatch = resolveFieldMatch(row.raw, { field: token });
          if (!tokenMatch) {
            continue;
          }

          rows.push({
            id: `${fieldSetIndex}-${fieldIndex}-structured-${token}`,
            label: fieldNameToTitle(token),
            value: toDisplayText(tokenMatch.value),
          });
          renderedKeys.add(tokenMatch.key);
        }

        continue;
      }

      if (field.type === "RemainingFields") {
        for (const rawKey of Object.keys(row.raw).sort((left, right) =>
          left.localeCompare(right),
        )) {
          if (renderedKeys.has(rawKey)) {
            continue;
          }

          const value = toDisplayText(row.raw[rawKey]);
          if (value === null) {
            continue;
          }

          rows.push({
            id: `${fieldSetIndex}-${fieldIndex}-remaining-${rawKey}`,
            label: fieldNameToTitle(rawKey),
            value,
          });
          renderedKeys.add(rawKey);
        }

        continue;
      }

      const matched = resolveFieldMatch(row.raw, field);
      const value = matched ? toDisplayText(matched.value) : null;
      rows.push({
        id: `${fieldSetIndex}-${fieldIndex}-${getProfileFieldIdentifier(field)}`,
        label: getProfileFieldLabel(field),
        value,
      });

      if (matched) {
        renderedKeys.add(matched.key);
      }
    }

    if (rows.length > 0) {
      sets.push({
        id: fieldSet.id ?? `${fieldSet.name}-${fieldSetIndex}`,
        name: fieldSet.name,
        rows,
      });
    }
  }

  return sets;
}

function buildFieldSets(row: LogRow, activeProfile: LogProfile | null): DrawerFieldSet[] {
  if (!activeProfile) {
    return buildDefaultFieldSets(row);
  }

  return buildProfileFieldSets(row, activeProfile);
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
  activeProfile?: LogProfile | null;
  selectedKey?: string;
  onClose: () => void;
  onOpenTrace: (traceId: string) => void;
}) {
  const { copyToClipboard } = useClipboard();
  const [wrapRawJson, setWrapRawJson] = React.useState(false);

  const isOpen = Boolean(props.selectedKey);
  const traceId = React.useMemo(() => {
    if (!props.row) {
      return null;
    }

    return (
      resolveCoreFieldDisplayText({
        record: props.row.raw,
        profile: props.activeProfile ?? null,
        coreField: "traceId",
      }) ??
      toDisplayText(props.row.raw.trace_id) ??
      toDisplayText(props.row.raw.TraceId) ??
      null
    );
  }, [props.activeProfile, props.row]);
  const fieldSets = React.useMemo(() => {
    if (!props.row) {
      return [];
    }

    return buildFieldSets(props.row, props.activeProfile ?? null);
  }, [props.activeProfile, props.row]);

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
              {fieldSets.map((fieldSet) => (
                <section key={fieldSet.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {fieldSet.name}
                    </h3>
                    {(fieldSet.name.toLowerCase().includes("trace") ||
                      fieldSet.name.toLowerCase().includes("correlation")) &&
                    traceId ? (
                      <button
                        type="button"
                        onClick={() => props.onOpenTrace(traceId)}
                        className="rounded border border-primary/40 px-2 py-0.5 text-[10px] text-primary"
                      >
                        Open Trace
                      </button>
                    ) : null}
                  </div>
                  {fieldSet.rows.map((fieldRow) => (
                    <DetailRow
                      key={fieldRow.id}
                      label={fieldRow.label}
                      value={fieldRow.value}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </section>
              ))}
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
