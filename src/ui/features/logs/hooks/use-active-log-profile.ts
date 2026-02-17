import { useQuery } from "@tanstack/react-query";
import { fetchActiveLogProfile } from "../api/client";

export function useActiveLogProfile() {
  return useQuery({
    queryKey: ["active-log-profile"],
    queryFn: fetchActiveLogProfile,
    staleTime: 60_000,
  });
}
