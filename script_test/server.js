const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "..", "user_data");
const STATE_FILE = path.join(DATA_DIR, "server_state.json");
const STATE_BACKUP_DIR = path.join(DATA_DIR, "state_backups");
const STATE_BACKUP_BACKUP_DIR = path.join(DATA_DIR, "backup_backup", "state_backups");
const AGENT_MODEL = process.env.DASHBOARD_AGENT_MODEL || "llama3.2:3b";
const MAX_STATE_BACKUPS = 10;
const GREAT_DELTA_SIZE_RATIO = 0.2;
const GREAT_DELTA_KEY_RATIO = 0.3;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_BACKUP_DIR)) fs.mkdirSync(STATE_BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(STATE_BACKUP_BACKUP_DIR)) fs.mkdirSync(STATE_BACKUP_BACKUP_DIR, { recursive: true });
}

function loadServerState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object") {
      return parsed.data;
    }
    // Backward compatibility: older files may store raw data directly.
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch (err) {
    return {};
  }
}

function loadRawStateFile() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (err) {
    return null;
  }
}

function extractStateData(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object") return payload.data;
  // Backward compatibility: support direct object payload as state.
  return payload;
}

function buildStateEnvelope(data) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  };
}

function isGreatDelta(previousData, nextData) {
  const prev = previousData && typeof previousData === "object" ? previousData : {};
  const next = nextData && typeof nextData === "object" ? nextData : {};

  const prevSerialized = JSON.stringify(prev);
  const nextSerialized = JSON.stringify(next);
  if (prevSerialized === nextSerialized) return false;
  if (Object.keys(prev).length === 0) return false;

  const prevLen = Math.max(1, prevSerialized.length);
  const sizeRatio = Math.abs(nextSerialized.length - prevSerialized.length) / prevLen;

  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));
  let changedKeys = 0;
  prevKeys.forEach((key) => {
    if (!nextKeys.has(key)) changedKeys += 1;
  });
  nextKeys.forEach((key) => {
    if (!prevKeys.has(key)) changedKeys += 1;
  });
  const keyRatio = changedKeys / Math.max(1, prevKeys.size);

  return sizeRatio >= GREAT_DELTA_SIZE_RATIO || keyRatio >= GREAT_DELTA_KEY_RATIO;
}

function pruneOldBackups() {
  ensureDataDir();
  const prune = (dirPath) => {
    const files = fs
      .readdirSync(dirPath)
      .filter((name) => /^server_state_\d{8}_\d{6}\.\d{3}_\d{3}\.json$/.test(name))
      .sort();
    const toDelete = files.slice(0, Math.max(0, files.length - MAX_STATE_BACKUPS));
    toDelete.forEach((name) => {
      try {
        fs.unlinkSync(path.join(dirPath, name));
      } catch (err) {
        // Ignore pruning failure to avoid blocking state writes.
      }
    });
  };

  prune(STATE_BACKUP_DIR);
  prune(STATE_BACKUP_BACKUP_DIR);
}

function backupCurrentStateIfNeeded(previousEnvelope, nextData) {
  const previousData = extractStateData(previousEnvelope);
  if (!isGreatDelta(previousData, nextData)) return;

  const now = new Date();
  const stamp =
    now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .replace("Z", "") + `_${String(now.getMilliseconds()).padStart(3, "0")}`;
  const backupName = `server_state_${stamp}.json`;
  const backupPath = path.join(STATE_BACKUP_DIR, backupName);
  const backupBackupPath = path.join(STATE_BACKUP_BACKUP_DIR, backupName);
  const backupPayload =
    previousEnvelope && typeof previousEnvelope === "object" ? previousEnvelope : buildStateEnvelope(previousData);
  const backupBody = JSON.stringify(backupPayload, null, 2);
  try {
    fs.writeFileSync(backupPath, backupBody, "utf8");
    fs.writeFileSync(backupBackupPath, backupBody, "utf8");
  } catch (err) {
    return;
  }
  pruneOldBackups();
}

function saveServerState(data) {
  ensureDataDir();
  const previousEnvelope = loadRawStateFile();
  backupCurrentStateIfNeeded(previousEnvelope, data);
  const payload = buildStateEnvelope(data);
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const safePath = decodeURIComponent(req.url.split("?")[0]);
  const relPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(PUBLIC_DIR, relPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const contentType = getContentType(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split("?")[0];

  if (pathname.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
  }

  if (pathname === "/health") {
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const data = loadServerState();
    return send(res, 200, { version: 1, data });
  }

  if (pathname === "/api/state" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const data = extractStateData(payload);
      if (!data) return send(res, 400, { error: "invalid_state" });
      saveServerState(data);
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 400, { error: "invalid_payload" });
    }
  }

  if (pathname === "/api/agent/health" && req.method === "GET") {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/tags");
      if (!response.ok) return send(res, 502, { ok: false, error: "ollama_unavailable" });
      return send(res, 200, { ok: true, model: AGENT_MODEL });
    } catch (err) {
      return send(res, 502, { ok: false, error: "ollama_unavailable" });
    }
  }

  if (pathname === "/api/agent/chat" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const question = String(payload.question || "").trim();
      const context = payload.context && typeof payload.context === "object" ? payload.context : {};
      if (!question) return send(res, 400, { error: "missing_question" });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const systemPrompt =
        "You are a local assistant for a personal dashboard. Use the provided dashboard context first. " +
        "Be concise and actionable. If data is missing, say what is missing.";

      const userPrompt = [
        "Dashboard context JSON:",
        JSON.stringify(context).slice(0, 180000),
        "",
        `Question: ${question}`,
      ].join("\n");

      const response = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AGENT_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return send(res, 502, { error: "agent_unavailable", detail: "Ollama returned an error" });
      }

      const result = await response.json();
      const reply = result && result.message && result.message.content ? result.message.content : "";
      if (!reply) return send(res, 502, { error: "empty_reply" });
      return send(res, 200, { reply, model: AGENT_MODEL, source: "ollama" });
    } catch (err) {
      return send(res, 502, {
        error: "agent_unavailable",
        detail: "Start Ollama locally (http://127.0.0.1:11434) and pull a model.",
      });
    }
  }

  if (serveStatic(req, res)) return;
  send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Dashboard server running on http://0.0.0.0:${PORT}`);
});
