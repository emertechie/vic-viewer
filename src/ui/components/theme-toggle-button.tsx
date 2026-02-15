import * as React from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/hooks/use-theme-mode";

export function ThemeToggleButton(props: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-input bg-card px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Switch to ${props.theme === "dark" ? "light" : "dark"} mode`}
    >
      {props.theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {props.theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
