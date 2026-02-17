import * as React from "react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { ThemeToggleButton } from "@/ui/components/theme-toggle-button";
import { createDefaultLogsSearch } from "@/ui/features/logs/state/search";
import { useThemeMode } from "@/ui/hooks/use-theme-mode";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <nav className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-tight">VicViewer</span>
          <div className="h-4 w-px bg-border" />
          <Link
            to="/logs"
            search={() => createDefaultLogsSearch()}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
          >
            Logs
          </Link>
          <Link
            to="/traces"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
          >
            Traces
          </Link>
        </nav>
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
