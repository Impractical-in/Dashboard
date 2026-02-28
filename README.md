# Local Dashboard

Terminal-style personal dashboard for tasks, projects, calendar, journaling, hobbies, links, and backups.

## What this repo contains

- `public/`: static frontend pages and browser-side logic
- `server/`: optional Node server for hosting + state APIs
- `script_test/`: Windows scripts to start/stop full local stack
- `user_data/`: server-side persisted state and backup snapshots

## Runtime modes

- Local mode (default): browser-local state, no server required
- Server mode (optional): `/api/state` endpoints provide shared state
- Future hosted mode (planned): Google-backed storage as canonical truth, with local/server cache

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- (Optional) Ollama for local AI endpoints

## Quick start (local mode)

1. Install dependencies:
   - `npm install`
2. Verify project quality gates:
   - `npm run verify`
3. Start server (optional for static hosting/API):
   - `npm start`
4. Open:
   - `http://localhost:8080`

If you run local-only from filesystem (`file://`), core UI still works with browser storage.

## Scripted full runtime (Windows)

- Start:
  - `./script_test/start.ps1 -OpenBrowser -ForceRestart`
- Stop:
  - `./script_test/stop.ps1`

## Feature list

- Dashboard home with module previews
- To-do with priority and due date handling
- Projects + learning entries with Gantt timeline
- Calendar month/week views with drag/resize
- Journal and hobbies tracking
- Local backup export/restore

## Versioning

- Canonical version is `package.json`
- `public/js/version.js` is synchronized by:
  - `npm run version:sync`
- CI enforces consistency via:
  - `npm run version:check`
- Bump commands:
  - `npm run version:bump:patch`
  - each bump also syncs `public/js/version.js` and prepends `docs/changelog.md`

## Quality tooling

- Lint: `npm run lint`
- Tests: `npm test`
- Format check: `npm run format:check`
- Full gate: `npm run verify`
- CI workflow: `.github/workflows/ci.yml`

## Security baseline

- Security headers applied by server
- Payload size + JSON-safe payload validation for state endpoints
- Security workflow:
  - CodeQL analysis
  - npm audit (prod dependencies)

See [Security Policy](docs/SECURITY.md).

## API contract (current)

### `GET /api/state`

Returns:

```json
{ "version": 1, "data": { "...": "..." } }
```

### `POST /api/state`

Accepts either:

```json
{ "version": 1, "updatedAt": "ISO_TIMESTAMP", "data": { "...": "..." } }
```

or direct object payload (backward compatibility).

### Backups

- `GET /api/state/backups`
- `POST /api/state/backups/upload`
- `POST /api/state/backups/restore`

## Environment variables

- `PORT` (default `8080`)
- `DASHBOARD_AGENT_MODEL`
- `OLLAMA_BASE_URL`
- `DASHBOARD_AGENT_TIMEOUT_MS`
- `DASHBOARD_AGENT_MAX_PREDICT`

## Troubleshooting

- Port in use: run server on alternate port (`PORT=8090`)
- Corrupt local browser state: open with reset query if supported or clear site storage
- Server state issues: inspect `user_data/server_state.json` and backup directories
- Ollama unavailable: disable agent usage or ensure Ollama is reachable

## Contributing

See [Contributing Guide](docs/CONTRIBUTING.md) and PR/issue templates in `.github/`.

## Architecture docs

- [Overview](docs/architecture/OVERVIEW.md)
- [Current Architecture and Model](docs/architecture/CURRENT_MODEL.md)
- [Storage provider contract](docs/architecture/STORAGE_PROVIDER_CONTRACT.md)
- [API reference](docs/API.md)
- [Changelog](docs/changelog.md)
- [Agent Architecture File](docs/agent.md)
