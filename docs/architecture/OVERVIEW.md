# Architecture Overview

See also: [CURRENT_MODEL.md](CURRENT_MODEL.md) for the exact current runtime architecture, data model, and active placeholder state.

## Modules

- `public/`: static UI pages + browser-side state and features.
- `server/`: optional Node API + static file hosting + backup endpoints.
- `script_test/`: local operator scripts for start/stop and runtime helpers.
- `user_data/`: persisted server state and backup artifacts.

## Runtime modes

- Local-only mode (default): browser localStorage/IndexedDB is authoritative.
- Server mode (optional): `/api/state` is authoritative for multi-device use.

## Source of truth strategy

- Today: local mode by default to avoid hard server dependency.
- Future hosted mode: use pluggable provider model where Google-backed sync is canonical.
  - UI writes to provider interface.
  - provider implementation decides local cache, server sync, retry semantics.

## Data flow constraints

- UI should not depend on server-only state for rendering.
- Server endpoints must accept envelope `{ version, updatedAt, data }`.
- Backups should be append-only snapshots with bounded retention.
