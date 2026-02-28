# agent.md

Single source of truth for architecture, flow, current model, and critical implementation notes.

## 1) Mission

Build and maintain a modular, minimal, terminal-style dashboard that runs locally today and can move to hosted multi-device usage later without rewrites.

## 2) Current Runtime Modes

- `Local mode (active default)`:
  - Browser storage is authoritative (`localStorage` + IndexedDB cache).
  - Server sync in UI runtime is disabled in `public/js/storage.js`.
- `Server mode (optional)`:
  - `server/server.js` exposes `/api/state` and backup APIs.
  - Used for hosting and future multi-device flow.
- `Future hosted mode`:
  - Planned provider model with Google-backed canonical source of truth.

## 3) High-Level Architecture

- `public/`
  - HTML pages + page controllers.
  - Shared UI system and terminal overrides.
- `public/js/core/dashboard-core.js`
  - Shared domain helpers:
    - date parsing/range logic
    - tags parsing
    - todo checklist normalization/parsing
    - task/project sorting
    - linked-items aggregation
- `server/`
  - Optional Node server:
    - static hosting
    - state + backup endpoints
    - optional local agent endpoints
- `user_data/`
  - persisted server state + backup snapshots

## 4) UI System (Propagated from Pomodoro style)

- Shared style file:
  - `public/css/ui-system.css`
- Loaded on all pages before terminal overrides.
- Holds reusable UI primitives:
  - `.topbar`, `.card`, `.tile`, `.btn`, `.field`, `.section-title`, `.linked-items`, pill/badge classes
- Final terminal look remains enforced by:
  - `public/css/terminal-overrides.css`

## 4.1) Home Layout Model (Current)

- `public/index.html` is now modular:
  - Top row: compact module menu buttons (`Overview`, `To-Do`, `Projects`, `Calendar`, etc.).
  - Main body: `Overview` pane containing the previous dashboard tile grid.
- This keeps one entry point while preserving the existing overview widgets/previews.
- Overflow guardrails are active in both base and terminal CSS to avoid boundary overshoot on smaller screens.

## 5) Data Model and Contract

Canonical envelope:

```json
{ "version": 1, "updatedAt": "ISO_TIMESTAMP", "data": { "...": "..." } }
```

Common keys in `data`:

- `todoTasks`
- `todoArchive`
- `dashboardEntries`
- `projectIssues`
- `localPomodoroLogs`
- `dashboardCalendarLayout`

Server validates payload shape and JSON-safe values before write.

## 6) Current Placeholder State (for testing)

- State data was intentionally cleaned from the repo.
- Keep only structure + `user_data/README.md`.
- New runtime state/backup files are created on demand by the server.

## 7) Current Model (LLM)

- Optional agent default model:
  - `llama3.2:3b`
- Override:
  - env `DASHBOARD_AGENT_MODEL`

## 8) Request/Flow Summary

### UI state flow (today)

1. Page loads `storage.js`
2. UI reads from browser storage
3. Feature controllers render from local state
4. Writes update local state immediately

### Server state flow (optional)

1. Client posts envelope to `/api/state`
2. Server validates payload
3. Server writes `user_data/server_state.json`
4. Server keeps backup snapshots for restore safety

### Backup flow

1. Export local snapshot JSON
2. Restore from JSON back into local/browser state
3. For server testing, placeholder JSON copied into `user_data/server_state.json`

## 9) Versioning and Release Flow

- Canonical version: `package.json`
- Sync command:
  - `npm run version:sync` updates `public/js/version.js`
- Check command:
  - `npm run version:check`
- Auto bump command (policy):
  - `npm run version:bump:patch`
- Policy:
  - From now on, each update is patch-only (`1.0.x`).
- Bump script also prepends changelog section.

## 10) Quality Gates

- `npm run lint`
- `npm test`
- `npm run format:check`
- `npm run verify` (full gate)

CI workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`

## 11) Invariants (Do Not Break)

- Keep local mode functional with no server dependency.
- Keep data envelope backward compatible.
- Keep terminal visual identity (pitch black + green accents).
- Keep shared logic in `public/js/core/dashboard-core.js` instead of duplicating in page scripts.
- If style appears in 2+ pages, put it in `public/css/ui-system.css`.

## 12) Next Minimal Refactor Steps

1. Extract feature services (`todo-service`, `projects-service`) from page controllers.
2. Keep page scripts as thin event wiring only.
3. Add storage provider interface (`local`, `server`, `google`) without changing feature logic.
