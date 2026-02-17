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
      as="div"
      language={props.language}
      theme={shikiThemes}
      defaultColor="light-dark()"
      showLanguage={false}
      addDefaultStyles={false}
      className={cn(
        "overflow-auto rounded border border-border text-[11px] [&_pre]:m-0 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[11px] [&_code]:font-mono [&_code]:text-[11px]",
        props.wrapText
          ? "[&_pre]:min-w-0 [&_code]:whitespace-pre-wrap [&_code]:break-all"
          : "[&_pre]:min-w-max [&_code]:whitespace-pre",
        props.className,
      )}
    >
      {props.code}
    </ShikiHighlighter>
  );
}
