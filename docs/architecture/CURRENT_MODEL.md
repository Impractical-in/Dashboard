# Current Architecture and Model

## Current architecture (implemented)

### Layers

- `public/js/core/dashboard-core.js`: shared domain helpers (date, tags, task/project normalization/sorting, linked-item aggregation).
- Page controllers:
  - `public/js/todo.js`
  - `public/js/projects.js`
  - other page scripts follow same pattern.
- Storage runtime:
  - `public/js/storage.js`
  - current mode is local-first (`canUseServerStateSync()` disabled).
- Optional server layer:
  - `server/server.js`
  - state + backup + optional agent endpoints.

### Data model

- Canonical envelope shape:

```json
{ "version": 1, "updatedAt": "ISO_TIMESTAMP", "data": { "...": "..." } }
```

- Main keys in `data` currently include:
  - `todoTasks`, `todoArchive`
  - `dashboardEntries`
  - `projectIssues`
  - `localPomodoroLogs`
  - `dashboardCalendarLayout`

### Placeholder test source

- State snapshots are not committed.
- `user_data/README.md` is retained as folder contract.
- Runtime state/backup files are generated locally by server writes.

## Current model (LLM/runtime)

- Optional local agent backend is configured in server.
- Current default model:
  - `llama3.2:3b`
- Override with env var:
  - `DASHBOARD_AGENT_MODEL`

## Source-of-truth status

- **Now**: browser-local state is source of truth for UI runtime.
- **Planned hosted mode**: provider-based sync where Google-backed storage becomes canonical truth, with local/server acting as caches.
