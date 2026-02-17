# Log Profiles and Response Shape Refactor Plan

## Context

We want to do two related changes:

1. Remove duplicated top-level fields from log rows (`message`, `streamId`, `stream`, `severity`, `serviceName`, `traceId`, `spanId`) and read values from `row.raw` instead.
2. Introduce profile-driven behavior for:
   - tie-breaker construction
   - logs table columns
   - log details field sets

These are coupled. The safest approach is one coordinated refactor, delivered in ordered phases.

## Confirmed Decisions

- Breaking API change is acceptable (no compatibility window required).
- Profiles are file-based for now.
- Default profile can be DotNet OpenTelemetry.
- `id` for columns/fields should be optional, not required.
- Special field `type` values should be designed now, but can be implemented incrementally.

## Why This Should Be One Coordinated Refactor

If we remove top-level fields first, we will still need a second round of UI/server rewiring for profiles.
Doing profiles first (or at least profile foundations first) avoids rewriting the same paths twice.

Recommended order:

1. Add profile infrastructure and switch rendering/tie-breaker to profile-driven field resolution.
2. Remove redundant top-level response fields.

## Profile Schema Direction (Simple, Extensible)

Keep the profile schema easy to author, with optional `id` where disambiguation is needed.

### Identity

- `id` (required): stable profile identifier (example: `dotnet-opentelemetry`)
- `name` (required): display name
- `version` (required): integer version for migration/hash invalidation

### Value Resolution

For fields that can appear under different keys (`trace_id` vs `TraceId`), support either:

- `field: string` for a single key, or
- `fields: string[]` for first-non-empty fallback order

### Optional IDs for Columns/Detail Fields

`id` is optional for `logTable.columns[*]` and `logDetails.fieldSets[*].fields[*]`.

When `id` is absent, derive a stable key using:

1. `field` when present
2. first item in `fields` when present
3. normalized `title`

If duplicates remain after derivation, log a profile validation error and fail startup (or reject profile) unless explicit `id` values disambiguate them.

This keeps authoring simple while protecting persisted settings (`visibleColumns`) from ambiguous identifiers.

## Proposed Phases

## Phase 1 - Profile Foundation (No Field Removal Yet)

Deliver:

- Add shared Zod profile schema in `src/shared/schemas/`.
- Add server profile loader/validator for YAML file(s).
- Add resolver utilities for raw field lookup and fallback fields.
- Add active profile plumbing to logs route and UI (single default profile).

Acceptance:

- Server boots with validated default profile.
- Profile can be fetched/used by UI without hard-coded columns/drawer sections.

## Phase 2 - Profile-Driven UI and Tie-Breaker

Deliver:

- Generate logs table columns from profile config.
- Generate log details field sets from profile config.
- Build tie-breaker from profile-configured fields.
- Use profile-configured message source for sequence extraction.
- Include `profile.id` and `profile.version` in cursor query hash context.

Acceptance:

- Table and drawer render correctly from profile data.
- Cursor paging remains deterministic across equal timestamps.

## Phase 3 - Remove Redundant Top-Level Fields (Breaking Change)

Deliver:

- Update `LogRow` schema to keep only:
  - `key`
  - `time`
  - `tieBreaker`
  - `raw`
- Remove duplicated normalized top-level fields from API payload.
- Update all server/UI call sites to resolve display/correlation values from `raw` via profile rules.

Acceptance:

- `/api/logs/query` returns compact row shape.
- Table, drawer, trace navigation, and paging all continue to work.

## Phase 4 - Special Field Types (Incremental)

### `StructuredLoggingFields`

Intent:

- Parse placeholders from `{OriginalFormat}` (example: `{elapsed}`, `{parameters}`, `{commandText}`).
- Emit fields for placeholders that exist in `raw` and are not already rendered.
- Sort emitted fields alphabetically for predictable output.

### `RemainingFields`

Intent:

- Emit all raw fields not already rendered by previous field sets (including generated structured fields).
- Output in alphabetical key order for deterministic UI.

### `sql`

Intent:

- Future renderer for SQL formatting/highlighting.
- For now: parse schema value but render as normal text.

## Migration Notes

- Existing `visibleColumns` values currently map to legacy top-level names.
- During rollout, migrate settings to profile column identifiers.
- `otelPresetEnabled` becomes obsolete once profile-driven behavior is in place and should be removed in a follow-up settings/schema cleanup.

## Initial Implementation Targets

- Profile file: `config/log-profiles/dotnet-opentelemetry.yml`.
- Shape reference for structured logging behavior: `src/tmp/data-shape.jsonc`.
- Existing redundant fields marked for removal: `src/server/logs/normalize.ts`.

## Execution Checklist

- [ ] Add profile schemas (shared) and profile loader (server).
- [ ] Add profile-aware raw field resolver utilities.
- [ ] Convert table and drawer to profile-driven configuration.
- [ ] Convert tie-breaker and sequence extraction to profile sources.
- [ ] Add profile identity/version into cursor hash context.
- [ ] Remove duplicated top-level log fields from API contract.
- [ ] Migrate visible column settings to profile column keys.
- [ ] Add `StructuredLoggingFields` and `RemainingFields` support.
- [ ] Keep `sql` typed but text-rendered until SQL viewer is introduced.
