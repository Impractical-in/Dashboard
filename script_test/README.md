# script_test Runtime

This folder runs the dashboard as a full local stack (UI + server + local agent) using scripts.

## One-command start
- Double click: `start.cmd`
- Or PowerShell:
  - `./script_test/start.ps1 -OpenBrowser -ForceRestart`

This will:
- Start Ollama if not already running
- Ensure the selected model exists (pulls it if missing)
- Start dashboard server
- Print local and LAN URLs you can open from other devices

## LAN access
Use one of the printed `http://<LAN_IP>:8080` URLs on another machine in the same network.

If another machine cannot connect:
- Allow Node.js through Windows Firewall (Private networks)
- Ensure both devices are on same LAN/VPN

## Stop
- Double click: `stop.cmd`
- Or PowerShell:
  - `./script_test/stop.ps1`

## Options
- Custom model:
  - `./script_test/start.ps1 -Model "llama3.2:3b"`
- Custom port:
  - `./script_test/start.ps1 -Port 8090`
- Do not auto-pull model:
  - `./script_test/start.ps1 -PullModelIfMissing:$false`

## Note about existing browser data
Use port `8080` to keep the same browser origin (`localhost:8080`) where your current dashboard data already exists.
