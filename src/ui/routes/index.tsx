import { createFileRoute, redirect } from "@tanstack/react-router";
import { createDefaultLogsSearch } from "@/features/logs/state/search";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/logs",
      search: createDefaultLogsSearch(),
    });
  },
});
