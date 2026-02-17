import * as React from "react";
import { TooltipProvider } from "@/ui/components/ui/tooltip";
import { useClipboard } from "@/ui/hooks/use-clipboard";
import type { LogProfile, LogRow } from "../api/types";
import { resolveCoreFieldDisplayText } from "../state/profile-fields";
import { LogDetailsFieldSetSection } from "./log-details-field-set-section";
import { buildProfileFieldSets } from "./log-details-field-sets";
import { LogDetailsRawJsonSection } from "./log-details-raw-json-section";

function DrawerEmptyState(props: { selectedKey?: string }) {
  return (
    <div className="rounded border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
      {props.selectedKey
        ? "Selected log is no longer loaded in the current window."
        : "No log selected."}
    </div>
  );
}

export function LogDetailsDrawer(props: {
  row: LogRow | null;
  activeProfile: LogProfile;
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
        profile: props.activeProfile,
        coreField: "traceId",
      }) ?? null
    );
  }, [props.activeProfile, props.row]);
  const fieldSets = React.useMemo(() => {
    if (!props.row) {
      return [];
    }

    return buildProfileFieldSets(props.row, props.activeProfile);
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
                <LogDetailsFieldSetSection
                  key={fieldSet.id}
                  fieldSet={fieldSet}
                  traceId={traceId}
                  onOpenTrace={props.onOpenTrace}
                  onCopy={copyToClipboard}
                />
              ))}
              <LogDetailsRawJsonSection
                raw={props.row.raw}
                wrapRawJson={wrapRawJson}
                onWrapRawJsonChange={setWrapRawJson}
              />
            </div>
          ) : (
            <DrawerEmptyState selectedKey={props.selectedKey} />
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
