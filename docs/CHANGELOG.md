# Changelog

## v0.2.0 (Current)
- Add calendar Quick Add panel to create one-off tasks and repeating task series directly in Calendar
- Keep drag/drop, resize, linked-series edits, and origin navigation behavior intact
- Add calendar custom color in Quick Add for new tasks
- Set calendar default view to Week
- Bump dashboard app version to `0.2.0`
- Keep local agent chat version at `0.1``r`n`r`n## v0.1.15
- Improve local agent reliability with clearer Ollama/model diagnostics in health checks
- Improve agent chat error messages by returning actual Ollama error details
- Reduce/trim agent context payload to avoid model failures on very large dashboard state
- Add one-click server backup restore APIs and UI (`/api/state/backups`, `/api/state/backups/restore`)
- Update dashboard layout so top row is only To-Do + Projects/Learning
- Rename backup tile and page to **Settings & Backup**
- Bump app version to `0.1.15`

## v0.1.4
- Add server-side delta backups when state changes are significant ("great delta")
- Keep only the latest 10 timestamped state backup files for redundancy
- Keep state API backward compatible with older payload/file shapes
- Set app version constant to `0.1.4`

## v0.1.8
- Add full-stack script launcher in `script_test/start.ps1` (server + Ollama checks)
- Print LAN URLs for access from other devices on same network
- Add model auto-pull option and improved stop script behavior

## v0.1.7
- Add `script_test` runtime folder to launch dashboard as local machine scripts
- Add script-managed start/stop commands (`start.ps1`, `stop.ps1`, `start.cmd`, `stop.cmd`)
- Include dedicated `script_test/server.js` with same app + local agent functionality

## v0.1.6
- Add local AI assistant endpoint at `POST /api/agent/chat` (Ollama-backed)
- Add floating bottom-right chat widget across all dashboard pages
- Send dashboard local context (tasks, projects, journal, hobbies, links, pomodoro) with chat requests

## v0.1.5
- Remove Google Drive backup integration
- Remove local server sync API and UI controls
- Keep Backup & Sync page local-only with file-backed snapshots
- Add restore-from-selected-file action for local backups

## v0.1.4
- Add Google Drive backup controls back to Sync page UI
- Add Google Identity script loading for OAuth
- Load OAuth client ID from /api/config (DASHBOARD_GOOGLE_CLIENT_ID)
- Add server API endpoint /api/config for client bootstrap
- Improve Sync page messaging when Google backup is not configured

## v0.1.3
- Serve UI + sync API from a single Node server/port
- Local server sync UI + auto URL defaulting
- Public assets moved under public/ for clean hosting
- Fix dark styling for inputs/suggestions
- Export backups use timestamped filenames

## v0.1.2
- Move done tasks out of the main list and into archive on save/refresh
- Add edit history logging for Projects/Learning entries
- Add local auto-backup (Chromium file handle)
- Add backup success message in Sync page
- Add app metadata (lastSavedAt) in backups and centralized versioning
- Update folder structure (public/css/js/assets/docs/user_data)

## v0.1.1
- Backup & Sync page (Google Drive appDataFolder + manual export/import)
- Tagging + linking across modules
- Dark theme update and dropdown fixes
- Home previews and layout refinements


