# LTM Log Viewer Plan Steps (Milestones 0-2)

This file breaks down implementation into small, checkable steps for an AI agent.  
Scope is limited to Milestone 0, Milestone 1, and Milestone 2 from `LTM_LOG_VIEWER_PLAN.md`.

## Working Rules

1. Complete steps in order.
2. Do not start Milestone 3+ work in this runbook.
3. After each step:
   - run `npm run format`
   - run `npm run typecheck`
4. Mark completed steps by changing `[ ]` to `[x]`.
5. If a step fails validation, fix before moving to next step.

## Phase 1: Milestone 0 (Backend Foundation)

### Step 1: Add backend dependencies and scripts

- [ ] Add required packages for Fastify, Drizzle, SQLite, and Zod.
- [ ] Add scripts for:
  - API dev run
  - DB migration generate/apply
  - combined UI+API local dev
- [ ] Update lockfile.

Done when:

- `package.json` includes backend/runtime/dev tooling scripts needed for Milestone 0-2.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 2: Create backend app bootstrap and health route

- [ ] Add server entrypoint and Fastify app factory.
- [ ] Add `GET /api/health` route returning service and DB readiness status.
- [ ] Add centralized error handler and request logging baseline.

Done when:

- API can boot and answer `GET /api/health` locally.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 3: Add Drizzle + SQLite setup

- [ ] Create Drizzle schema for logs-view settings singleton.
- [ ] Add DB client/bootstrap module.
- [ ] Configure Drizzle migration output directory.

Done when:

- Schema and DB connection code compile.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 4: Create first migration and DB initialization flow

- [ ] Generate initial migration for settings table.
- [ ] Add startup init that ensures schema is applied.
- [ ] Upsert default singleton settings row if absent.

Done when:

- DB initializes on startup and settings singleton exists.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 5: Add shared Zod schemas for API contracts

- [ ] Create shared schema module for:
  - settings payloads
  - logs query payload (including cursor field)
  - common error response shape
- [ ] Ensure request parsing and response typing derive from Zod schemas.

Done when:

- Route handlers can import typed schemas from one place.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 6: Implement settings endpoints

- [ ] Add `GET /api/settings/logs-view`.
- [ ] Add `PUT /api/settings/logs-view` with Zod validation.
- [ ] Persist via Drizzle to singleton settings row.

Done when:

- Settings roundtrip works and survives restart.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 7: Add VicStack server config and client scaffolding

- [ ] Add typed config for VictoriaLogs/Traces/Metrics base URLs.
- [ ] Add VictoriaLogs client module in server layer.
- [ ] Add timeout/cancellation and upstream error mapping scaffolding.

Done when:

- Server has reusable client utilities for upstream calls.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 8: Milestone 0 close-out checks

- [ ] Add or update basic integration tests for:
  - health route
  - settings GET/PUT
- [ ] Confirm startup path includes DB readiness and singleton seed.

Done when:

- Milestone 0 features are test-covered and compile cleanly.

Verify:

- `npm run format`
- `npm run typecheck`
- run project test command(s) relevant to backend tests

## Phase 2: Milestone 1 (Query + Time Range + URL State)

### Step 9: Define final `/api/logs/query` request/response schema

- [ ] Implement Zod contracts for:
  - request: `{ query, start, end, limit, cursor? }`
  - response: `{ rows, pageInfo }`
  - `pageInfo`: `olderCursor?`, `newerCursor?`, `hasOlder`, `hasNewer`
- [ ] Enforce `query` default handling in frontend route state (default `*` when missing).

Done when:

- Contract is explicit and compile-time typed on both server and UI.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 10: Implement directional cursor utilities in backend

- [ ] Add cursor encode/decode utilities.
- [ ] Include token fields:
  - `v`
  - `dir` (`older` or `newer`)
  - `queryHash`
  - `window` (`start`, `end`)
  - `anchor` (`time`, `streamId`, `tieBreaker`)
- [ ] Add cursor validation and mismatch rejection logic.

Done when:

- Server can decode cursor intent and reject invalid or stale cursors.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 11: Implement `/api/logs/query` route using VictoriaLogs client

- [ ] Map incoming request to VictoriaLogs query calls.
- [ ] Normalize rows to UI model:
  - `time`, `message`, `streamId`, `stream`, `severity`, `serviceName`, `traceId`, `spanId`, `raw`
- [ ] Build deterministic sort/tie-break behavior.
- [ ] Return directional `pageInfo` cursors.

Done when:

- Query endpoint returns normalized rows and bidirectional cursors.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 12: Add logs route search-param schema in UI

- [ ] Define TanStack Router search param parsing for:
  - `q`, `range`, `start`, `end`, `live`, `selected`
- [ ] Ensure URL is source of truth.
- [ ] Ensure default query is `*` when `q` missing.

Done when:

- Reload/share URL preserves query/time/live state.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 13: Build query bar and time range controls

- [ ] Implement LogsQL input.
- [ ] Implement relative presets and absolute time picker.
- [ ] Wire submit/update into route search params.

Done when:

- User can change query and time range entirely through URL-backed controls.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 14: Wire UI data fetching to `/api/logs/query`

- [ ] Use TanStack Query for request lifecycle.
- [ ] Include cancellation on rapid changes.
- [ ] Render loading, empty, and error states.

Done when:

- Query UX works end-to-end with backend route.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 15: Milestone 1 close-out checks

- [ ] Add tests for:
  - URL search param parsing/defaults
  - query route validation failures
  - cursor mismatch handling
- [ ] Confirm `q=*` default behavior on first load.

Done when:

- Milestone 1 is functionally complete and validated.

Verify:

- `npm run format`
- `npm run typecheck`
- run project test command(s) relevant to added tests

## Phase 3: Milestone 2 (Virtualized Infinite Table)

### Step 16: Introduce virtualized table shell

- [ ] Create table component using TanStack Table + TanStack Virtual.
- [ ] Add sticky header and large-list rendering baseline.
- [ ] Keep component boundaries small and composable.

Done when:

- Large row sets render smoothly in virtualized viewport.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 17: Implement bidirectional page loading in UI

- [ ] Track `olderCursor` and `newerCursor` in client state (not URL).
- [ ] Fetch older pages when scrolling upward.
- [ ] Fetch newer pages within range when scrolling downward/backfill.

Done when:

- User can page both directions within fixed time window.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 18: Add dedupe, stable merge, and memory cap

- [ ] Merge pages by deterministic row key.
- [ ] Prevent duplicates across page boundaries.
- [ ] Enforce max retained rows in memory.

Done when:

- Infinite paging stays stable and bounded.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 19: Preserve scroll stability and bottom semantics

- [ ] Ensure prepend (older rows) does not cause disruptive jump.
- [ ] Preserve newest-at-bottom behavior.
- [ ] Add logic for user-at-bottom detection to support later live mode.

Done when:

- Scroll behavior remains predictable during page loads.

Verify:

- `npm run format`
- `npm run typecheck`

### Step 20: Milestone 2 close-out checks

- [ ] Add tests for:
  - dedupe merge logic
  - bidirectional cursor paging behavior
  - memory cap eviction behavior
- [ ] Run manual perf sanity check with large synthetic dataset.

Done when:

- Milestone 2 is complete, stable, and test-backed.

Verify:

- `npm run format`
- `npm run typecheck`
- run project test command(s) relevant to added tests

## Exit Criteria for This Runbook

- [ ] Milestone 0 complete
- [ ] Milestone 1 complete
- [ ] Milestone 2 complete
- [ ] No work started for Milestone 3+
