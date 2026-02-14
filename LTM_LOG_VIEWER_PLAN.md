# LTM Viewer Plan (Phase 1: Logs First, BFF Included)

## Confirmed Decisions

1. Start with a backend immediately (no browser-direct VicStack calls).
2. URL is the source of truth for query/time/live state.
3. Live tail is enabled by default, with a user toggle to pause/disable.
4. Settings that matter in v1 should be persisted via backend endpoints.
5. Backend stack requirements: Fastify, Drizzle (with migrations), SQLite, Zod.

## Scope

Build a fast local developer app for logs first, with architecture that cleanly extends to traces and metrics.

Primary v1 flow:

1. Enter LogsQL query + time range.
2. Browse logs in a virtualized infinite table.
3. Open log details in a right-hand drawer.
4. Live tail new logs by default.

## Platform Feasibility

Victoria APIs needed for LTM are available:

- VictoriaLogs: `/select/logsql/query`, `/select/logsql/hits`, `/select/logsql/tail`
- VictoriaTraces: Jaeger-compatible `/select/jaeger/api/...`
- VictoriaMetrics: Prometheus-compatible `/api/v1/query`, `/api/v1/query_range`

References:

- https://docs.victoriametrics.com/victorialogs/querying/
- https://docs.victoriametrics.com/victoriatraces/querying/
- https://docs.victoriametrics.com/victoriametrics/url-examples/

## Target Architecture

## Frontend

- TanStack Router for route-level URL state.
- TanStack Query for data lifecycle and cache.
- TanStack Table + TanStack Virtual for large log lists.
- ShadCN + Tailwind for UI.

## Backend (BFF)

- Fastify API server (`/api/*` only exposed to frontend).
- Zod for request/response validation and typed contracts.
- Drizzle ORM with SQLite for persisted app preferences/settings.
- VicStack connector layer inside BFF for logs/traces/metrics upstream calls.

## Why BFF immediately

- One stable contract for frontend.
- Easier auth/security controls later.
- Centralized query normalization, limits, and error mapping.
- Persistence available from day one for settings.

## Proposed Repo Shape

- `src/ui/`
  - existing React app
  - add `features/logs/*` modules for query bar, table, drawer, live tail controls
- `src/server/`
  - `app.ts` Fastify setup
  - `routes/` (`logs.ts`, `settings.ts`, later `traces.ts`, `metrics.ts`)
  - `vicstack/` upstream clients (`victoriaLogsClient.ts`, etc.)
  - `db/` drizzle schema + migrations + db bootstrap
  - `schemas/` zod schemas shared by route handlers
- `drizzle/`
  - generated migration files

## BFF API Contract (Phase 1)

## Logs endpoints

- `POST /api/logs/query`
  - Input: `{ query, start, end, limit, cursor? }`
  - Output: `{ rows, pageInfo }`
  - Backend maps to VictoriaLogs query API and normalizes payload.
- `GET /api/logs/tail/sse`
  - SSE endpoint for live logs (EventSource-compatible).
  - Query params include `query` plus tail window options.
- `GET /api/logs/histogram` (optional in v1)
  - Uses hits API for time-bucket volume chart.

### Bidirectional cursor contract

Single `nextCursor` is not sufficient for a fixed time window where users can page both older and newer data.

- `pageInfo` shape:
  - `{ olderCursor?, newerCursor?, hasOlder, hasNewer }`
- `cursor` is an opaque, directional token returned by `pageInfo`:
  - client sends `olderCursor` value to page backward (older logs)
  - client sends `newerCursor` value to page forward (newer logs)
- token payload (encoded, optionally signed) includes:
  - `v` (cursor version)
  - `dir` (`older` or `newer`)
  - `queryHash` (hash of query + window + sort contract)
  - `window` (`start`, `end`)
  - `anchor` (`time`, `streamId`, `tieBreaker`)
- server behavior:
  - reject cursor when `queryHash`/`window` does not match request context
  - always use deterministic ordering to avoid gaps/dupes on equal timestamps
  - return both cursors when available for continued bidirectional paging

## Settings endpoints

- `GET /api/settings/logs-view`
- `PUT /api/settings/logs-view`

Initial settings payload:

- `defaultLiveEnabled` (bool)
- `rowDensity` (`comfortable | compact`)
- `wrapLines` (bool)
- `visibleColumns` (string[])
- `defaultRelativeRange` (`5m | 15m | 1h | 6h | 24h`)
- `otelPresetEnabled` (bool)

All settings payloads validated with Zod. Persist to SQLite through Drizzle.
Settings are stored as a single local profile (singleton row), not multi-profile.

## URL State Contract (source of truth)

Use TanStack Router search params for:

- `q` (LogsQL)
- `range` (relative token or `absolute`)
- `start` and `end` (ISO if absolute)
- `live` (`1` or `0`)
- `selected` (optional selected log key for drawer)

Rule:

- URL drives the query.
- persisted settings provide defaults only when URL params are absent.
- if `q` is absent, default to `*`.
- paging cursors are ephemeral UI state (not URL state), because they depend on live dataset position.

## Log Data Normalization (from your sample OTEL log)

Normalize each row in BFF before sending UI model:

- `time`: `_time`
- `message`: `_msg`
- `streamId`: `_stream_id`
- `stream`: `_stream`
- `severity`: `severity` (fallback `SeverityText` if ever present)
- `serviceName`: `service.name`
- `traceId`: first non-empty of `trace_id`, `TraceId`
- `spanId`: first non-empty of `span_id`, `SpanId`
- `raw`: full original log object

Stable row key:

- first choice: `${streamId}:${time}:${spanId || traceId || message}`
- fallback: hash of normalized JSON

## Functional Milestones

## Milestone 0: Backend Foundation

Deliver:

- Fastify server bootstrapped in dev mode.
- Drizzle + SQLite initialized.
- migration workflow wired.
- shared zod schema package/module for API contracts.
- singleton settings row initialized (or upserted) on startup.

Acceptance:

- `npm` scripts can run migrations and start UI + API.
- health endpoint confirms API and DB readiness.

## Milestone 1: Query + Time Range + URL State

Deliver:

- Logs query bar with LogsQL input.
- Relative/absolute time selector.
- URL state syncing for all query params.
- BFF `POST /api/logs/query` wired end-to-end.

Acceptance:

- reload preserves current query/time/live state from URL.
- first load with no URL params runs default query `*`.
- backend enforces validation and returns typed errors.

## Milestone 2: Virtualized Infinite Table

Deliver:

- large-list virtualized logs table.
- newest at bottom, older at top.
- upward infinite load for older pages via `olderCursor`.
- downward backfill for newer pages within the fixed range via `newerCursor`.
- dedupe and bounded memory.

Acceptance:

- smooth scroll and no visible rerender jank on big result sets.

## Milestone 3: Log Drawer + Trace Link Hook

Deliver:

- RHS drawer with structured sections and raw JSON.
- copy actions for trace/span/request identifiers.
- "Open Trace" CTA enabled when `traceId` exists.

Acceptance:

- drawer open/close is instant and keyboard accessible.

## Milestone 4: Live Tail Default-On

Deliver:

- live tail auto-start when `/logs` opens (`live=1` default if absent).
- user toggle to pause/disable (`live=0` in URL).
- reconnect and backoff strategy.
- auto-scroll only when user is at bottom.

Acceptance:

- stable long-running tail session without UI lockups.

## Milestone 5: Settings Persistence

Deliver:

- settings read on page load and applied as defaults.
- settings update API used by UI preference panel.

Acceptance:

- settings survive refresh/restart and do not override explicit URL params.

## Milestone 6: OTEL Preset View

Deliver:

- predefined OTEL-focused column/filter preset using normalized fields.
- quick filters for `serviceName`, `severity`, `traceId`.

Acceptance:

- one-click useful view for your current .NET OTEL logs.

## Traces and Metrics Readiness (Next Phase)

The BFF can expose immediately after logs are stable:

- `GET /api/traces/services` -> VictoriaTraces `/select/jaeger/api/services`
- `GET /api/traces/operations`
- `POST /api/traces/search`
- `GET /api/traces/:traceId`
- `GET /api/metrics/query`
- `GET /api/metrics/query-range`

This keeps frontend independent from raw Victoria endpoint differences.

## Quality and Guardrails

- Zod at every boundary:
  - route input parsing
  - upstream response validation/defensive parsing
  - settings payload validation
- Query safety:
  - server-side max limit clamps
  - timeout + cancellation propagation
  - clear user-facing error mapping
- Performance:
  - virtualized rendering
  - React Query cancellation and stale tuning
  - cap retained rows in live mode
- Tests:
  - unit: time-range + cursor + normalization logic
  - integration: Fastify routes with mocked VicStack
  - UI: query bar, table paging, live toggle, drawer selection

## Suggested Build Order

1. Backend foundation (Fastify + Drizzle + SQLite + Zod).
2. `POST /api/logs/query` + frontend query/time/url flow.
3. virtualized infinite table.
4. live tail endpoint + default-on client behavior.
5. drawer and trace link scaffolding.
6. settings endpoints + UI settings panel.
7. OTEL preset view.

## Finalized Decisions

1. Settings storage model: single local profile.
2. Live tail transport: SSE.
3. Default query on first load: `*`.
