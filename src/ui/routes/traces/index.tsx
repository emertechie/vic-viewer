import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const tracesSearchSchema = z.object({
  traceId: z.string().optional(),
});

export const Route = createFileRoute("/traces/")({
  validateSearch: (search) => tracesSearchSchema.parse(search),
  component: TracesPage,
});

function TracesPage() {
  const search = Route.useSearch();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">Trace Viewer Coming Soon</h1>
      {search.traceId ? (
        <p className="text-sm text-muted-foreground">
          Requested trace ID: <code className="rounded bg-muted px-1 py-0.5">{search.traceId}</code>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No trace selected.</p>
      )}
    </div>
  );
}
