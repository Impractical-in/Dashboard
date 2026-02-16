# Local Dashboard

A lightweight personal dashboard to track tasks, projects, journaling, habits, and focus sessions.

## Versions
- Single source of truth: `public/js/version.js`
- Dashboard and Agent versions are read from that file by both UI and server.

## Features
- Home overview with quick access
- To-do list with priorities and due dates
- Projects + learning tracker
- Journal with tags and links
- Calendar view of tasks and schedules
- Hobbies tracker with streaks
- Pomodoro timer
- Server-first state sync (`/api/state`) as source of truth
- Settings & Backup page:
  - local snapshot export/import
  - server backup list + one-click restore
  - upload backup JSON to server from any device

## Local Agent Chat (Optional)
You can run a local AI chat assistant with dashboard context and open it from the bottom-right chat button.

1. Install and run Ollama locally (`http://127.0.0.1:11434`).
2. Pull a model (example): `ollama pull llama3.2:3b`
3. Start dashboard server:
   - `node server/server.js`
4. Open any dashboard page and click the `AI` chat button.

Optional model override:
- PowerShell: `$env:DASHBOARD_AGENT_MODEL="llama3.2:3b"`

## Script Runtime (`script_test`)
If you want the app launched like a local machine script (browser UI + script-managed backend):

- Start: `./script_test/start.ps1 -OpenBrowser -ForceRestart`
- Stop: `./script_test/stop.ps1`

Use port `8080` to keep the same existing browser data origin (`localhost:8080`).

## Fresh Machine (Git Clone) Setup
If you clone this repo on another machine and want the same runtime behavior:

1. Install Node.js.
2. Install Ollama.
3. Run:
   - `ollama pull llama3.2:3b`
4. Start stack:
   - `./script_test/start.ps1 -OpenBrowser -ForceRestart`

The launcher will:
- start/verify Ollama,
- start dashboard server,
- print local + LAN URLs.

## Data & Backups
- Active app state is persisted on server in `user_data/server_state.json`.
- Great-delta backups are stored in:
  - `user_data/state_backups`
  - `user_data/backup_backup/state_backups`
- Each backup location keeps the latest 10 files.
