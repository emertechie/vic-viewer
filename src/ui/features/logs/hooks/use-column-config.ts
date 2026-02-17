import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteColumnConfig, fetchColumnConfig, putColumnConfig } from "../api/client";
import type { ColumnConfig, ColumnConfigEntry, LogProfile } from "../api/types";
import { getProfileFieldIdentifier, getProfileFieldLabel } from "../state/profile-fields";

function columnConfigQueryKey(profileId: string) {
  return ["column-config", profileId] as const;
}

/** Derive the default visible columns from the profile's logTable.columns definition. */
export function getDefaultColumns(profile: LogProfile): ColumnConfigEntry[] {
  return profile.logTable.columns
    .filter((col) => !col.hidden)
    .map((col) => ({
      id: getProfileFieldIdentifier(col),
      title: getProfileFieldLabel(col),
      field: col.field,
      fields: col.fields,
    }));
}

export function useColumnConfig(profile: LogProfile | undefined) {
  const queryClient = useQueryClient();
  const profileId = profile?.id;

  const query = useQuery({
    queryKey: columnConfigQueryKey(profileId ?? ""),
    queryFn: () => fetchColumnConfig(profileId!),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (config: ColumnConfig) => putColumnConfig(profileId!, config),
    onSuccess: (saved) => {
      queryClient.setQueryData(columnConfigQueryKey(profileId!), saved);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => deleteColumnConfig(profileId!),
    onSuccess: () => {
      queryClient.setQueryData(columnConfigQueryKey(profileId!), null);
    },
  });

  /** The effective visible columns: persisted config if available, otherwise profile defaults. */
  const columns: ColumnConfigEntry[] =
    query.data?.columns ?? (profile ? getDefaultColumns(profile) : []);

  return {
    columns,
    isLoading: query.isLoading,
    /** Whether the user has a custom config or is using profile defaults. */
    isCustomised: Boolean(query.data),
    save: (config: ColumnConfig) => saveMutation.mutate(config),
    saveAsync: (config: ColumnConfig) => saveMutation.mutateAsync(config),
    reset: () => resetMutation.mutate(),
    isSaving: saveMutation.isPending,
  };
}
