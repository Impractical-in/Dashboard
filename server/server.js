const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.DASHBOARD_TOKEN || "";

const DATA_DIR = path.join(__dirname, "..", "user_data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const DATA_FILE = path.join(DATA_DIR, "dashboard.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function handleCors(req, res) {
  if (!req.url.startsWith("/api/")) return false;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
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

function isAuthorized(req) {
  if (!TOKEN) return true;
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return fs.readFileSync(DATA_FILE, "utf8");
}

function backupCurrent() {
  if (!fs.existsSync(DATA_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `dashboard_${stamp}.json`);
  fs.copyFileSync(DATA_FILE, backupPath);
}

const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.url === "/api/data" && req.method === "GET") {
    if (!isAuthorized(req)) return send(res, 401, { error: "unauthorized" });
    const data = loadData();
    if (!data) return send(res, 200, { version: 1, data: {} });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(data);
    return;
  }

  if (req.url === "/api/data" && req.method === "POST") {
    if (!isAuthorized(req)) return send(res, 401, { error: "unauthorized" });
    try {
      const raw = await readBody(req);
      JSON.parse(raw);
      ensureDirs();
      backupCurrent();
      fs.writeFileSync(DATA_FILE, raw);
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 400, { error: err.message || "invalid" });
    }
  }

  if (req.url === "/health") {
    return send(res, 200, { ok: true });
  }

  if (serveStatic(req, res)) return;
  send(res, 404, { error: "not_found" });
});

ensureDirs();
server.listen(PORT, () => {
  console.log(`Dashboard sync server running on http://0.0.0.0:${PORT}`);
});
