# UI Implementation Plan

## Overview

Build a React UI for viewing OpenTelemetry logs with infinite scrolling, virtualization, and live tailing. The UI will be served from `src/ui/` via Vite, proxying API requests to the existing Fastify backend on port 4319.

## Architecture Summary

```
Browser (localhost:5173)
  ├── GET /api/logs?limit=N&cursor=X&direction=forward|backward
  │                                    →  Fastify (bidirectional cursor pagination)
  └── GET /api/logs/stream (SSE)        →  Fastify (real-time new logs)
```

The log viewer has two data flows:

1. **History** -- loaded via bidirectional cursor-based pagination (scroll UP for older, scroll DOWN for newer when browsing a time range)
2. **Tailing** -- new logs pushed via Server-Sent Events, appended at the BOTTOM

## Tech Stack

| Concern        | Choice                                                |
| -------------- | ----------------------------------------------------- |
| UI framework   | React 19 (already installed)                          |
| Build          | Vite 7 (already configured)                           |
| Routing        | TanStack Router (file-based)                          |
| Table          | TanStack Table v8 (already installed)                 |
| Virtualization | TanStack Virtual v3 (already installed)               |
| Data fetching  | TanStack Query (new dependency)                       |
| Styling        | Tailwind CSS v4 (via `@tailwindcss/vite`) + shadcn/ui |

## Reference Implementation

The [TanStack virtualized-infinite-scrolling example](https://github.com/TanStack/table/blob/main/examples/react/virtualized-infinite-scrolling/src/main.tsx) demonstrates the core pattern: `useInfiniteQuery` + `useReactTable` + `useVirtualizer`. It is a solid foundation but requires these adaptations:

| Example pattern                                    | Our adaptation                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Scroll down to load more                           | Bidirectional: scroll UP for older, scroll DOWN for newer         |
| Offset-based pagination (`pageParam` = page index) | Cursor-based with `direction` param (`nextCursor` / `prevCursor`) |
| Knows `totalRowCount` upfront                      | No total count; stop when cursor is null for that direction       |
| No real-time updates                               | SSE stream appends new logs at the bottom                         |
| Single flat list                                   | Two data sources merged: history (paginated) + live tail (SSE)    |

---

## Phase 1: Log Viewer (Current Focus)

### 1.1 Project Setup

- [ ] Install new dependencies:
  - `@tanstack/react-query`
  - `@tanstack/react-router` + `@tanstack/react-router-devtools` + `@tanstack/react-router-vite-plugin`
  - `tailwindcss` + `@tailwindcss/vite`
- [ ] Install shadcn/ui and configure it (will install its own dependencies like `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, etc.)
- [ ] Create `src/ui/` directory structure:
  ```
  src/ui/
  ├── index.html
  ├── main.tsx            # React entry point, QueryClientProvider
  ├── global.css          # Tailwind imports, shadcn theme variables
  ├── lib/
  │   └── utils.ts        # cn() helper for shadcn
  ├── routes/
  │   ├── __root.tsx       # Root layout (shell, nav)
  │   └── logs/
  │       └── index.tsx    # Log viewer page
  ├── components/
  │   ├── ui/             # shadcn components (auto-generated)
  │   ├── log-table.tsx   # Main log table component
  │   ├── log-row-detail.tsx  # Expandable log detail panel
  │   └── severity-badge.tsx  # Severity level color indicator
  └── lib/
      ├── api.ts          # API client (fetch logs, types)
      └── use-log-stream.ts  # SSE hook for live tailing
  ```
- [ ] Update `vite.config.ts` to add Tailwind plugin and TanStack Router plugin
- [ ] Update `tsconfig.json` if needed (path aliases for `@/` if shadcn requires it)

### 1.2 Server Changes

#### SSE endpoint: `GET /api/logs/stream`

- [ ] Add an SSE endpoint to `src/server.ts`
- The endpoint holds the connection open and pushes new log rows as they are ingested
- Implementation approach: use an in-memory event emitter. When `POST /v1/logs` inserts rows, emit them. The SSE handler listens and writes each log as an SSE `data:` line.
- Each SSE message contains one log object (same shape as `/api/logs` items)
- Include a `Last-Event-ID` support using the log `id` so clients can reconnect and catch up

```
event: log
id: 42
data: {"id":42,"time_unix_nano":"...","severity_text":"INFO",...}
```

#### Update existing `/api/logs` endpoint

- [ ] Make the API **bidirectional** with `cursor` and `direction` query parameters:
  - `GET /api/logs?limit=200` -- no cursor: returns the most recent N logs in ascending chronological order
  - `GET /api/logs?limit=200&cursor=X&direction=backward` -- returns N logs older than the cursor, in ascending chronological order
  - `GET /api/logs?limit=200&cursor=X&direction=forward` -- returns N logs newer than the cursor, in ascending chronological order
- [ ] Response shape changes from `{ items, nextCursor }` to `{ items, nextCursor, prevCursor }`:

  ```json
  {
    "items": [ ... ],
    "nextCursor": "...",   // points to newer logs (null if at the latest)
    "prevCursor": "..."    // points to older logs (null if at the oldest)
  }
  ```

  - `nextCursor` is derived from the last (newest) item in the page
  - `prevCursor` is derived from the first (oldest) item in the page
  - Items are always returned in **ascending chronological order** within a page

- [ ] Update `listLogs` in `SQLiteStore` to accept a `direction` parameter that controls the `ORDER BY` and comparison operators in the WHERE clause. Both directions use keyset pagination on `(time_unix_nano, id)`.
- [ ] Vite proxy already handles CORS for dev -- no changes needed.

### 1.3 Shared Types

- [ ] Create a shared types file (e.g. `src/shared/log-types.ts`) for the log API response shape, so both server and UI can reference the same type. Or, define UI-side types in `src/ui/lib/api.ts` that mirror the server response (simpler, avoids monorepo complexity).

Decision: Keep it simple -- define the API response types in the UI code for now. The server response shape is stable and documented.

### 1.4 Log Table Component (`log-table.tsx`)

This is the core component, combining:

#### Data fetching with `useInfiniteQuery`

- Fetches pages of logs from `GET /api/logs?limit=200&cursor=X&direction=forward|backward`
- Uses both `getNextPageParam` (for newer/forward) and `getPreviousPageParam` (for older/backward) from `useInfiniteQuery`
- The API always returns rows in **ascending chronological order** within each page
- Pages are naturally ordered: `[...oldestPage, ..., newestPage]` -- no reversal needed
- **Tailing mode** (default): initial fetch with no cursor gets the latest page. `fetchPreviousPage` loads older logs on scroll-up. SSE appends newer logs at the end.
- **Time range mode** (Phase 2+): initial fetch with a `startTime` param. `fetchNextPage` loads newer logs on scroll-down. `fetchPreviousPage` loads older logs on scroll-up.

#### SSE tailing with a custom hook (`use-log-stream.ts`)

- Connects to `GET /api/logs/stream` using `EventSource`
- Appends new log rows to the end of the merged data array
- When the user is scrolled to the bottom, auto-scroll to show new logs
- When scrolled away from bottom, show a "N new logs" indicator; clicking it scrolls to bottom

#### Merging history + live data

- `useInfiniteQuery` manages pages in chronological order via `getPreviousPageParam` (older) and `getNextPageParam` (newer)
- All pages flatten naturally into chronological order: `[...oldestPage, ..., newestPage]`
- SSE `liveRows` are appended after the history: `[...historyRows, ...liveRows]`
- Deduplicate by `id` at the boundary (a newly fetched page might overlap with SSE rows)

#### TanStack Table configuration

- Columns (all shown by default):
  | Column | Source field | Notes |
  |--------|------------|-------|
  | Timestamp | `time_unix_nano` | Format as `HH:mm:ss.SSS` (relative today) or `YYYY-MM-DD HH:mm:ss.SSS` |
  | Severity | `severity_text` | Color-coded badge (TRACE=gray, DEBUG=blue, INFO=green, WARN=yellow, ERROR=red, FATAL=red bold) |
  | Service | `service_name` | Plain text |
  | Message | `body_json` | Parse JSON, extract string body. Truncate long messages. |
  | Trace ID | `trace_id` | Monospace, truncated with copy-on-click |
  | Attributes | `attributes_json` | Parse JSON, show as compact key=value pairs, truncated |

#### TanStack Virtual configuration

- Vertical virtualizer on the scroll container
- `estimateSize`: ~32px per row
- `overscan`: 10 rows
- The scroll container is the full viewport height minus header/nav

#### Inverted infinite scroll (scroll UP to load history)

- Detect when user scrolls near the TOP of the container (within 500px)
- Trigger `fetchPreviousPage()` to load the next older page
- After prepending rows, restore scroll position so the view doesn't jump (use `useVirtualizer`'s `scrollToIndex` or manual offset adjustment)
- In future time-range mode: also detect scroll near BOTTOM to trigger `fetchNextPage()` for newer logs

#### Auto-scroll / tailing behavior

- Track whether user is "at the bottom" (within ~50px of scroll end)
- If at bottom and new SSE logs arrive, auto-scroll to keep newest visible
- If user scrolls up, stop auto-scrolling and show a floating "Jump to latest (N new)" button
- Clicking the button scrolls to bottom and resumes auto-scroll

### 1.5 Log Row Detail Panel (`log-row-detail.tsx`)

- Clicking a row opens a side panel (right drawer) showing full log details
- Shows:
  - Full message body (formatted JSON if applicable)
  - All attributes as a key-value table
  - Resource attributes
  - Scope name/version
  - Trace ID + Span ID (full, with copy buttons)
  - Raw timestamps
- Use shadcn `Sheet` component for the side panel

> **Note**: A side panel (rather than inline expansion) keeps the virtual list simple with fixed row heights, avoiding the complexity of dynamic row heights in the virtualizer.

### 1.6 UI Shell & Routing

- [ ] Root layout (`__root.tsx`): minimal shell with a left sidebar or top nav
  - Nav items: "Logs" (active), "Traces" (placeholder/disabled)
  - App title/logo area
- [ ] `/logs` route renders the log table
- [ ] Default route `/` redirects to `/logs`

### 1.7 Styling & Design

- Dark theme by default (appropriate for a developer tool / log viewer)
- Monospace font for log content (body, trace IDs, attributes)
- Dense table rows (compact padding) for maximum log density
- Severity colors: consistent, accessible color palette
- Use shadcn components for: buttons, badges, scroll area, sheet (side panel), skeleton (loading states)
- Install shadcn components as needed via `npx shadcn@latest add <component>`

---

## Phase 2: Log Filtering (Future)

- Filter bar above the log table
- Filters: severity level, service name (dropdown), text search (body/attributes), time range
- **Time range browsing**: selecting a time range starts pagination at that point and uses bidirectional cursors -- `fetchNextPage` scrolls forward in time, `fetchPreviousPage` scrolls backward. This is natively supported by the bidirectional API from Phase 1.
- Filters apply to both the paginated query AND the SSE stream (server-side filtering on SSE, or client-side filtering of SSE events)
- Debounced text search
- URL-synced filter state (so filters survive page refresh)
- Server changes: add filter query parameters to `GET /api/logs` and `GET /api/logs/stream`

## Phase 3: Traces Viewer (Future)

- `/traces` route with a trace list (similar infinite scroll table)
- Click a trace to see a waterfall/timeline view of spans
- Link from log trace_id to the trace detail view
- Server endpoints: `GET /api/traces`, `GET /api/traces/:traceId/spans`

---

## Testing Strategy

### Overview

Tests are organized into three layers, each targeting different concerns at different speeds. All tests live under a top-level `tests/` directory.

```
tests/
├── server/
│   ├── db/
│   │   └── sqlite-logs.test.ts       # SQLiteStore.listLogs unit tests
│   ├── api/
│   │   ├── logs-endpoint.test.ts     # GET /api/logs integration tests
│   │   ├── logs-stream.test.ts       # GET /api/logs/stream SSE tests
│   │   └── ingest.test.ts            # POST /v1/logs ingestion tests
│   └── helpers/
│       └── test-db.ts                # Temp DB factory, seed helpers
├── ui/
│   ├── components/
│   │   ├── log-table.test.tsx         # Log table rendering & interactions
│   │   ├── log-row-detail.test.tsx    # Detail panel content & formatting
│   │   └── severity-badge.test.tsx    # Severity color mapping
│   └── lib/
│       └── format.test.ts            # Timestamp formatting, body parsing
├── e2e/
│   ├── logs-viewer.spec.ts           # Full log viewing flow
│   └── logs-tailing.spec.ts          # Live tailing flow
└── fixtures/
    └── otlp-payloads.ts              # Reusable OTLP test payloads
```

### Tools

| Tool                   | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| Vitest                 | Test runner for server and UI unit/integration tests |
| Fastify `app.inject()` | HTTP-level API tests without starting a real server  |
| React Testing Library  | UI component rendering and interaction tests         |
| jsdom (via Vitest)     | DOM environment for component tests                  |
| Playwright             | E2E browser tests                                    |

### Layer 1: Server / DB Tests (fastest, highest density)

These are the most critical tests. The bidirectional cursor pagination has significant edge-case surface area.

#### `sqlite-logs.test.ts` -- Store unit tests

Test `listLogs` directly against a temp SQLite database. Each test seeds specific data and asserts query results.

**Core pagination cases:**

- [ ] No cursor, no data → empty result, both cursors null
- [ ] No cursor, fewer rows than limit → returns all rows ASC, prevCursor null, nextCursor null
- [ ] No cursor, more rows than limit → returns latest N rows ASC, prevCursor set, nextCursor null
- [ ] Backward from cursor → returns N older rows ASC, correct prevCursor/nextCursor
- [ ] Forward from cursor → returns N newer rows ASC, correct prevCursor/nextCursor
- [ ] Backward past the oldest row → returns remaining rows, prevCursor null
- [ ] Forward past the newest row → returns remaining rows, nextCursor null
- [ ] Cursor at exact boundary (first or last row) → correct behavior

**Ordering and consistency:**

- [ ] Items always returned in ascending `(time_unix_nano, id)` order regardless of direction
- [ ] Rows with identical `time_unix_nano` are disambiguated by `id`
- [ ] Walking forward then backward through pages visits every row exactly once (round-trip consistency)
- [ ] Full walk: paginate forward from the oldest to newest, then backward, producing the same complete dataset

**Limit edge cases:**

- [ ] `limit=1` → single-row pages with correct cursors
- [ ] Limit clamped to max (1000)
- [ ] Limit of 0 or negative → error or clamped

#### `logs-endpoint.test.ts` -- API integration tests

Test `GET /api/logs` via `app.inject()`. Covers serialization, query param validation, and cursor encoding.

- [ ] Default request (no params) → 200, correct JSON shape, items in ASC order
- [ ] `limit` param respected
- [ ] Invalid `limit` → 400
- [ ] Valid `cursor` + `direction=backward` → correct page
- [ ] Valid `cursor` + `direction=forward` → correct page
- [ ] Invalid cursor string → 400
- [ ] Missing direction when cursor present → default behavior (backward for compatibility)
- [ ] `bigint` fields serialized as strings in response
- [ ] `nextCursor` / `prevCursor` are valid base64url strings that round-trip correctly

#### `logs-stream.test.ts` -- SSE integration tests

- [ ] Connection returns `Content-Type: text/event-stream`
- [ ] Ingesting a log via `POST /v1/logs` emits an SSE event to connected clients
- [ ] SSE event format: correct `event:`, `id:`, `data:` fields
- [ ] Multiple connected clients all receive the event
- [ ] `Last-Event-ID` header on reconnect → catches up missed logs
- [ ] Client disconnect cleans up the listener (no memory leak)

#### `ingest.test.ts` -- Ingestion tests

- [ ] Valid OTLP log payload → 200, data queryable via `GET /api/logs`
- [ ] Gzip-encoded body → correctly decoded and stored
- [ ] Malformed JSON → 400
- [ ] Large batch insert (1000+ logs) → all stored correctly

#### Test helpers (`test-db.ts`)

- `createTestDb()` -- creates a temp SQLite DB (in-memory or temp file), returns a `SQLiteStore` instance
- `seedLogs(store, count, overrides?)` -- inserts N log rows with sequential timestamps, returns the inserted rows
- `createTestApp(store)` -- creates a Fastify app instance wired to the given store, ready for `app.inject()`

### Layer 2: UI Component Tests (medium speed)

Test React components in isolation with mocked data. Run in Vitest with jsdom.

#### `log-table.test.tsx`

- [ ] Renders column headers (Timestamp, Severity, Service, Message, Trace ID, Attributes)
- [ ] Renders log rows with correct data in each column
- [ ] Clicking a row calls the detail panel handler with the correct log
- [ ] Empty state shown when no logs
- [ ] Loading state shown while fetching

#### `log-row-detail.test.tsx`

- [ ] Renders all log fields (body, attributes, resource, trace ID, span ID, timestamps)
- [ ] JSON bodies are pretty-printed
- [ ] Copy buttons present for trace ID and span ID
- [ ] Handles missing/null fields gracefully

#### `severity-badge.test.tsx`

- [ ] Each severity level renders with the correct color class
- [ ] Unknown/null severity renders a neutral badge

#### `format.test.ts`

- [ ] `time_unix_nano` string → formatted timestamp
- [ ] Today's timestamps show time only (`HH:mm:ss.SSS`)
- [ ] Older timestamps show full date+time
- [ ] `body_json` parsing: string body, JSON object body, null body
- [ ] `attributes_json` parsing: key-value pairs, empty, null

### Layer 3: E2E Tests (slowest, highest integration confidence)

Playwright tests that run the real server and UI together.

#### `logs-viewer.spec.ts`

- [ ] Page loads, navigates to /logs
- [ ] Log table renders with data from the server
- [ ] Scrolling up loads older logs (new rows appear above)
- [ ] Clicking a log row opens the detail panel
- [ ] Detail panel shows correct information for the selected log

#### `logs-tailing.spec.ts`

- [ ] New logs ingested via POST appear in the table automatically
- [ ] Auto-scroll keeps newest logs visible when at the bottom
- [ ] Scrolling up pauses auto-scroll, shows "jump to latest" indicator
- [ ] Clicking "jump to latest" scrolls to bottom and resumes auto-scroll

#### E2E test setup

- Start the server with a temp database before each test file
- Seed initial data via direct `POST /v1/logs` calls
- Use Playwright's `page.waitForSelector` and scroll simulation
- Tear down server and temp DB after each test file

### NPM Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:server": "vitest run tests/server",
  "test:ui": "vitest run tests/ui",
  "test:e2e": "playwright test",
  "test:all": "vitest run && playwright test"
}
```

### Vitest Configuration

A single `vitest.config.ts` at the project root with two project workspaces:

- **server** -- runs in Node environment, includes `tests/server/**`
- **ui** -- runs in jsdom environment, includes `tests/ui/**`

---

## Implementation Order (Phase 1)

A suggested sequence for implementation:

1. **Project scaffolding** -- Install deps, create `src/ui/` structure, configure Tailwind + shadcn + TanStack Router, verify `npm run dev:ui` serves a blank page
2. **Test infrastructure** -- Install Vitest + Playwright, configure workspaces (server/ui), create test helpers (`createTestDb`, `seedLogs`, `createTestApp`), verify a trivial test runs
3. **Bidirectional pagination (server)** -- Update `SQLiteStore.listLogs` and `GET /api/logs` endpoint, write DB + API tests alongside (this is the most edge-case-dense area)
4. **Basic log table** -- Static table rendering with TanStack Table, column definitions, basic styling. Write component tests.
5. **Infinite scroll with API** -- Connect to `GET /api/logs` via `useInfiniteQuery`, implement bidirectional scroll, virtualization
6. **SSE server endpoint** -- Add `GET /api/logs/stream` to Fastify with EventEmitter pattern. Write SSE integration tests.
7. **Live tailing** -- Connect SSE in the UI, merge with history data, auto-scroll behavior, "jump to latest" button
8. **Log detail panel** -- Side panel on row click, show full log details. Write component tests.
9. **E2E tests** -- Playwright tests for the full log viewing and tailing flows
10. **Polish** -- Loading/empty states, error handling, severity badges, timestamp formatting, responsive layout

---

## Key Risks & Mitigations

| Risk                                                                                    | Mitigation                                                                                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Inverted scroll + virtualization is tricky (scroll position jumps when prepending data) | Use `useVirtualizer`'s `scrollToIndex` with `align: 'start'` after prepending. Test thoroughly. May need to pin scroll offset manually. |
| Merging history + SSE data with deduplication                                           | Use log `id` as the unique key. SSE logs will have higher IDs than any historical page. Only deduplicate at the boundary.               |
| Large attribute/body JSON slowing down rendering                                        | Truncate in table cells. Only render full JSON in the detail panel. Consider `JSON.stringify` length limits.                            |
| SSE reconnection losing logs                                                            | Use `Last-Event-ID` header on reconnect. Server catches up from that ID.                                                                |
| bigint serialization (time_unix_nano)                                                   | Already handled -- server converts to string in the API response. UI parses back to number/BigInt as needed for formatting.             |
| Bidirectional pagination adds server complexity                                         | Both directions use the same keyset pagination on `(time_unix_nano, id)` -- just flip comparison operators and ORDER BY direction.      |

## Open Questions

- Should we add a "clear logs" or "purge database" button in the UI?
- Should tailing be on by default, or should there be a toggle?
  - Recommendation: on by default, with a visible pause/resume toggle
