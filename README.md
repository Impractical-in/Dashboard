# Local Dashboard

A lightweight personal dashboard to track tasks, projects, journaling, habits, and focus sessions.

## Features
- Home overview with quick access
- To-do list with priorities and due dates
- Projects + learning tracker
- Journal with tags and links
- Calendar view of tasks and schedules
- Hobbies tracker with streaks
- Pomodoro timer
- Local backup & restore tools

## Local Backup (No Cloud)
The app stores active data in browser storage for speed.
To keep data permanent on your PC even if browser data is cleared:

1. Open `http://localhost:8080/sync.html`
2. Click `Choose backup file` and select a JSON file on disk
3. Enable `Auto snapshot`
4. Optionally click `Save snapshot now` any time

If browser data is ever cleared, use:
- `Restore snapshot file` (if the chosen file handle is still available), or
- `Import JSON` using your saved backup file.

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
