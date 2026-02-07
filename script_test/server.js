const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "..", "user_data");
const STATE_FILE = path.join(DATA_DIR, "server_state.json");
const AGENT_MODEL = process.env.DASHBOARD_AGENT_MODEL || "llama3.2:3b";

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
    return {};
  } catch (err) {
    return {};
  }
}

function saveServerState(data) {
  ensureDataDir();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  };
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
      const data = payload && payload.data && typeof payload.data === "object" ? payload.data : null;
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
