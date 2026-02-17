import * as React from "react";
import ShikiHighlighter from "react-shiki";
import { useThemeMode } from "@/ui/hooks/use-theme-mode";
import { cn } from "@/ui/lib/utils";

export function LogDetailsCodeBlock(props: {
  code: string;
  language: "json" | "sql";
  wrapText?: boolean;
  className?: string;
}) {
  const { shikiThemes } = useThemeMode();

  return (
    <ShikiHighlighter
      language={props.language}
      theme={shikiThemes}
      defaultColor="light-dark()"
      showLanguage={false}
      addDefaultStyles={false}
      className={cn(
        "overflow-auto rounded border border-border p-2 text-[11px] [&_code]:block [&_code]:font-mono [&_code]:text-[11px]",
        props.wrapText
          ? "[&_code]:min-w-0 [&_code]:whitespace-pre-wrap [&_code]:break-all"
          : "[&_code]:min-w-max [&_code]:whitespace-pre",
        props.className,
      )}
      style={{ backgroundColor: "var(--shiki-background)" }}
    >
      {props.code}
    </ShikiHighlighter>
  );
}
