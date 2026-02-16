# Deterministic Log Test Data Plan

## Context

Manual verification is currently unreliable because local data drifts away from "now" and does not consistently cover relative windows (5m/15m/1h), infinite scroll edge cases, or live tail behavior.

This plan introduces a deterministic fake `victoriaLogsClient` mode in the API so the app exercises the same query/cursor/normalization UI flow while returning predictable synthetic logs.

## Goals

1. Relative ranges always return data, especially `15m` through `1h` (and broader windows).
2. Infinite scrolling can be visually verified for gaps/overlaps using obvious sequence markers.
3. Live tail can be validated for ordering, insertion position, and stream continuity.
4. Most application logic stays exercised (server routes, cursor filtering, normalization, client merge/paging).

## Non-Goals

- Replacing production-like integration testing against real VictoriaLogs.
- Perfectly emulating every LogsQL behavior.
- Long-term persistent synthetic data storage.

## Chosen Direction

- Primary path: **fake client mode** (switchable via config/env).
- Sequence strategy: **global monotonic sequence** across all generated logs.
- Live tail strategy: **switchable profiles** (steady, bursty, noisy).

## High-Level Design

### 1) Add a pluggable logs data source mode

Add a new config flag to server startup, e.g.:

- `LOGS_DATA_MODE=vicstack|fake` (default `vicstack`)
- `FAKE_LOGS_PROFILE=steady|bursty|noisy` (default `steady`)
- `FAKE_LOGS_SEED=...` for reproducibility

At server composition time (`src/server/index.ts`), choose:

- real `createVictoriaLogsClient(...)` when `vicstack`
- new `createFakeVictoriaLogsClient(...)` when `fake`

This keeps route behavior in `src/server/routes/logs.ts` unchanged so cursor and normalization logic stay fully exercised.

### 2) Fake client contract and behavior

Implement `src/server/vicstack/fakeVictoriaLogsClient.ts` matching `VictoriaLogsClient`:

- `queryRaw({ query, start, end, limit })` returns records in raw shape expected by existing extraction/normalization.
- Generate records from a deterministic in-memory timeline spanning at least last 30 days.
- Dense recent coverage:
  - 0-1h: high density
  - 1h-24h: medium density
  - 1d-30d: lower density
- Always include logs near now so `5m/15m/1h` consistently return results.

Suggested generated fields per record:

- `_time`: ISO timestamp
- `_stream_id`: deterministic stream id
- `_stream`: stream labels/service info
- `_msg`: starts with global sequence, e.g. `000012345 | svc=api | profile=bursty | ...`
- `severity`, `service.name`, optional `trace_id`/`span_id`

### 3) Visual verification encoding for gaps/overlaps

Message prefix format:

- `SEQ:<zero-padded-global-int>` as the first token in `_msg`

Verification expectations:

- Scrolling older/newer never skips numbers unexpectedly.
- No repeated sequence unless intentionally injected by noisy profile.
- Sequence ordering should align with time ordering rules used by `compareLogRows`.

Optional enhancement:

- Add every Nth marker message (e.g. `CHECKPOINT:<n>`) to aid quick manual spot checks.

### 4) Live tail simulation profiles

Implement a lightweight in-process generator used by fake mode:

- `steady`: fixed rate (e.g. 1-3 logs/sec)
- `bursty`: short bursts and quiet periods
- `noisy`: includes occasional same-timestamp events, slight out-of-order emission, and duplicate ids (small percentage)

Even before dedicated `/tail` endpoint work, fake mode should keep "recent query reruns" meaningful. When tail endpoint is implemented, reuse the same profile generator for SSE.

### 5) Query filtering strategy in fake mode

To maximize logic coverage without full LogsQL parser:

- Always enforce `start/end/limit` exactly.
- Support a practical subset of query filtering:
  - `*` returns all
  - `service.name:<value>`
  - `severity:<value>`
  - free-text contains match on `_msg`
- Document unsupported query syntax clearly in fake mode docs/log output.

## Implementation Phases

### Phase 1 - Fake mode scaffold

1. Add config/env flags and startup selection.
2. Add fake client implementing current `VictoriaLogsClient` interface.
3. Add deterministic dataset generation with global monotonic sequence.

Acceptance:

- App runs in fake mode and `/api/logs/query` returns stable deterministic pages.
- `Last 15m` and `Last 1h` always show logs.

### Phase 2 - Scroll verification hardening

1. Encode sequence-first message format and optional checkpoints.
2. Add profile-aware data generation patterns.
3. Add minimal docs for manual verification workflow.

Acceptance:

- Manual up/down infinite scrolling can visually detect gaps/overlaps quickly.

### Phase 3 - Live-focused behavior

1. Add switchable steady/bursty/noisy behaviors into recent windows.
2. Wire generator for future SSE tail endpoint reuse.

Acceptance:

- With live enabled, newly appearing messages follow expected order and profile behavior.

## Manual Verification Checklist

1. Start app with `LOGS_DATA_MODE=fake` and profile `steady`.
2. Verify `5m`, `15m`, `1h`, `24h` all load data.
3. Scroll upward repeatedly; confirm sequence continuity and no unexpected duplicates.
4. Scroll back down; confirm continuity remains intact.
5. Switch profile to `bursty`, verify UI handles spikes without visual breaks.
6. Switch profile to `noisy`, verify dedupe/order behavior is understandable and stable.

## Risks and Mitigations

- Risk: fake mode diverges from real upstream shape.
  - Mitigation: keep raw record shape aligned to normalization expectations; add a small compatibility test fixture from real payloads.
- Risk: over-simplified query support gives false confidence.
  - Mitigation: document supported subset and keep periodic real VicStack smoke tests.
- Risk: deterministic data feels too clean.
  - Mitigation: noisy profile intentionally introduces realistic edge conditions.

## Follow-up Work (Optional)

1. Add a tiny script to emit equivalent synthetic logs into real VictoriaLogs for integration-mode checks.
2. Add test utilities around sequence continuity assertions for paging merge functions.
3. Add a debug UI badge showing active data mode/profile to avoid confusion.
