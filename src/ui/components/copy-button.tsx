import * as React from "react";
import { Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/ui/tooltip";

const COPIED_TOOLTIP_DURATION_MS = 500;

export function CopyButton(props: {
  label: string;
  disabled?: boolean;
  onCopy: () => Promise<void> | void;
}) {
  const [showCopiedTooltip, setShowCopiedTooltip] = React.useState(false);
  const hideTooltipTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (hideTooltipTimerRef.current !== null) {
        window.clearTimeout(hideTooltipTimerRef.current);
      }
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    await props.onCopy();
    setShowCopiedTooltip(true);

    if (hideTooltipTimerRef.current !== null) {
      window.clearTimeout(hideTooltipTimerRef.current);
    }

    hideTooltipTimerRef.current = window.setTimeout(() => {
      setShowCopiedTooltip(false);
      hideTooltipTimerRef.current = null;
    }, COPIED_TOOLTIP_DURATION_MS);
  }, [props.onCopy]);

  const tooltipOpen = showCopiedTooltip ? true : undefined;
  const tooltipLabel = showCopiedTooltip ? "Copied" : `Copy ${props.label}`;

  return (
    <Tooltip open={tooltipOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={props.disabled}
          onClick={handleCopy}
          className="inline-flex h-5 w-5 items-center justify-center rounded border border-input text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          aria-label={`Copy ${props.label}`}
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
