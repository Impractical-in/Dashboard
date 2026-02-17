# Changelog

## v0.3.1 (Current)
- Bump dashboard version to `0.3.1` (single-source version from `public/js/version.js`)
- Improve multi-device sync safety:
  - merge dirty local keys with latest server state before push
  - periodic/focus-based server pull to reduce stale views across devices
- Simplify Backup page to two primary actions only:
  - save current snapshot (`server` or `my device`)
  - upload selected snapshot JSON to server
- Expand Issue Tracker with integrated FR support:
  - type selector (`Bug` / `FR`)
  - type-aware ID prefix (`BUG-...` / `FR-...`)
  - type-aware UI labels and filters

## v0.3.0
- Bump dashboard version to `0.3.0`
- Bump agent version to `v0.2`
- Add Home page Issue Tracker:
  - project-specific IDs (`BUG-<2-char-project-code>-YYYYMMDD-####`)
  - quick add, severity, status workflow
  - optional details fields and history notes
- Move runtime versioning to single source: `public/js/version.js`
- Update agent context retrieval to include only relevant server-state slices for faster responses

## v0.1.15
- Improve local agent reliability and health diagnostics
- Return clearer Ollama error details from agent chat
- Trim large agent context payloads for better stability
- Add server backup APIs and UI:
  - `/api/state/backups`
  - `/api/state/backups/restore`
  - `/api/state/backups/upload`
- Update home layout (top row focus on To-Do + Projects/Learning)
- Rename backup page/tile to **Settings & Backup**

## v0.1.8
- Add full-stack script launcher in `script_test/start.ps1`
- Print LAN URLs for same-network access
- Add model auto-pull option and improved stop behavior

## v0.1.7
- Add `script_test` runtime folder and script-managed start/stop commands
- Include dedicated `script_test/server.js`

## v0.1.6
- Add local AI assistant endpoint: `POST /api/agent/chat`
- Add floating chat widget across dashboard pages
- Send dashboard context (tasks/projects/journal/hobbies/links/pomodoro) with chat requests

## v0.1.5
- Remove Google Drive backup integration
- Remove old local server-sync UI controls
- Keep backup workflow local-file based with restore action

## v0.1.4
- Add server-side delta backups for significant state changes
- Keep up to 10 timestamped backup files for redundancy
- Keep state API backward compatible with older payload/file shapes
- Improve backup/sync UI messaging and OAuth bootstrap flow

## v0.1.3
- Serve UI + sync API from one Node server/port
- Add local server sync UI with URL defaults
- Move public assets under `public/`
- Fix dark styling for inputs/suggestions
- Use timestamped export filenames

## v0.1.2
- Move completed tasks to archive on save/refresh
- Add edit history for Projects/Learning entries
- Add local auto-backup (Chromium file handle)
- Add backup success messaging
- Add app metadata and centralized versioning support

## v0.1.1
- Introduce Backup & Sync page
- Add tagging + linking across modules
- Improve dark theme and dropdown behavior
- Refine home previews/layout
