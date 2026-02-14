import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/logs/")({
  component: LogsPage,
});

function LogsPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Log viewer coming soon</p>
    </div>
  );
}
