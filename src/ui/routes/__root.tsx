import * as React from "react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center border-b border-border px-4">
        <nav className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-tight">VicViewer</span>
          <div className="h-4 w-px bg-border" />
          <Link
            to="/logs"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
          >
            Logs
          </Link>
          <span className="cursor-not-allowed text-sm text-muted-foreground/50" title="Coming soon">
            Traces
          </span>
        </nav>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
