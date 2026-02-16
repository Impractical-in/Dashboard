const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "..", "user_data");
const STATE_FILE = path.join(DATA_DIR, "server_state.json");
const USER_PROFILE_FILE = path.join(DATA_DIR, "user_name.json");
const STATE_BACKUP_DIR = path.join(DATA_DIR, "state_backups");
const STATE_BACKUP_BACKUP_DIR = path.join(DATA_DIR, "backup_backup", "state_backups");
const AGENT_MODEL = process.env.DASHBOARD_AGENT_MODEL || "llama3.2:3b";
const AGENT_VERSION = "v0.1";
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "";
const MAX_STATE_BACKUPS = 10;
const GREAT_DELTA_SIZE_RATIO = 0.2;
const GREAT_DELTA_KEY_RATIO = 0.3;
const BACKUP_FILE_PATTERN = /^server_state_\d{8}_\d{6}\.\d{3}_\d{3}(?:_[a-zA-Z0-9._-]+)?\.json$/;
const AGENT_CONTEXT_MAX_ITEMS = 40;
const AGENT_CONTEXT_MAX_STRING = 3000;
const AGENT_TIMEOUT_MS = Math.max(10000, Number(process.env.DASHBOARD_AGENT_TIMEOUT_MS || 90000));
const AGENT_PROMPT_CONTEXT_LIMIT = Math.max(
  5000,
  Number(process.env.DASHBOARD_AGENT_CONTEXT_PROMPT_LIMIT || 50000)
);
const AGENT_MAX_PREDICT = Math.max(32, Number(process.env.DASHBOARD_AGENT_MAX_PREDICT || 160));
const AGENT_KEEP_ALIVE = process.env.DASHBOARD_AGENT_KEEP_ALIVE || "30m";
const AGENT_RETRIEVAL_ITEM_LIMIT = Math.max(5, Number(process.env.DASHBOARD_AGENT_RETRIEVAL_ITEM_LIMIT || 20));

function getOllamaBases() {
  const bases = [
    OLLAMA_BASE,
    "http://127.0.0.1:11434",
    "http://localhost:11434",
  ];
  return Array.from(new Set(bases.filter(Boolean)));
}

async function fetchFromOllama(pathname, options = {}) {
  const bases = getOllamaBases();
  const errors = [];
  for (const base of bases) {
    try {
      if (options.signal && options.signal.aborted) {
        const abortErr = new Error("The operation was aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      const response = await fetch(`${base}${pathname}`, options);
      return { response, base, errors };
    } catch (err) {
      if ((err && err.name === "AbortError") || (options.signal && options.signal.aborted)) {
        throw err;
      }
      const message = err && err.message ? err.message : "unknown_error";
      errors.push(`${base}: ${message}`);
    }
  }
  const finalError = new Error(errors.join(" | ") || "ollama_unreachable");
  finalError.name = "OllamaUnavailableError";
  throw finalError;
}

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

function readJsonFileSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return fallback;
  }
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
      .filter((name) => BACKUP_FILE_PATTERN.test(name))
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

  writeBackupEnvelope(previousEnvelope && typeof previousEnvelope === "object"
    ? previousEnvelope
    : buildStateEnvelope(previousData));
}

function writeBackupEnvelope(backupPayload) {
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
  const backupBody = JSON.stringify(backupPayload, null, 2);
  try {
    fs.writeFileSync(backupPath, backupBody, "utf8");
    fs.writeFileSync(backupBackupPath, backupBody, "utf8");
  } catch (err) {
    return;
  }
  pruneOldBackups();
}

function listBackupsFrom(dirPath, source) {
  ensureDataDir();
  const names = fs.readdirSync(dirPath).filter((name) => BACKUP_FILE_PATTERN.test(name)).sort().reverse();
  return names.map((name) => {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);
    return {
      name,
      source,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  });
}

function listAllBackups() {
  const primary = listBackupsFrom(STATE_BACKUP_DIR, "primary");
  const secondary = listBackupsFrom(STATE_BACKUP_BACKUP_DIR, "secondary");
  return { primary, secondary };
}

function readBackupEnvelope(name, source) {
  if (!BACKUP_FILE_PATTERN.test(name)) return null;
  const baseDir = source === "secondary" ? STATE_BACKUP_BACKUP_DIR : STATE_BACKUP_DIR;
  const fullPath = path.join(baseDir, name);
  if (!fullPath.startsWith(baseDir) || !fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (err) {
    return null;
  }
}

function normalizeBackupEnvelope(input) {
  if (!input || typeof input !== "object") return null;
  const data = extractStateData(input);
  if (!data || typeof data !== "object") return null;
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  };
}

function writeUploadedBackup(nameHint, envelope) {
  const now = new Date();
  const stamp =
    now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .replace("Z", "") + `_${String(now.getMilliseconds()).padStart(3, "0")}`;
  const safeHint = String(nameHint || "uploaded")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 40);
  const backupName = `server_state_${stamp}_${safeHint}.json`;
  const body = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(path.join(STATE_BACKUP_DIR, backupName), body, "utf8");
  fs.writeFileSync(path.join(STATE_BACKUP_BACKUP_DIR, backupName), body, "utf8");
  pruneOldBackups();
  return backupName;
}

function forceBackupCurrentState() {
  const currentEnvelope = loadRawStateFile();
  if (!currentEnvelope || typeof currentEnvelope !== "object") return;
  writeBackupEnvelope(currentEnvelope);
}

function saveServerState(data) {
  ensureDataDir();
  const previousEnvelope = loadRawStateFile();
  backupCurrentStateIfNeeded(previousEnvelope, data);
  const payload = buildStateEnvelope(data);
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function truncateString(value, maxLen = AGENT_CONTEXT_MAX_STRING) {
  const str = String(value);
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}...[truncated]`;
}

function sanitizeForAgent(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const sliced = value.slice(0, AGENT_CONTEXT_MAX_ITEMS);
    return sliced.map((item) => sanitizeForAgent(item, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 6) return "[max-depth]";
    const out = {};
    Object.entries(value).slice(0, AGENT_CONTEXT_MAX_ITEMS).forEach(([k, v]) => {
      out[k] = sanitizeForAgent(v, depth + 1);
    });
    return out;
  }
  return String(value);
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pickString(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function loadLatestBackupState() {
  ensureDataDir();
  const collectFromDir = (dirPath, source) => {
    if (!fs.existsSync(dirPath)) return [];
    return fs
      .readdirSync(dirPath)
      .filter((name) => BACKUP_FILE_PATTERN.test(name))
      .map((name) => {
        const fullPath = path.join(dirPath, name);
        const stat = fs.statSync(fullPath);
        return { name, fullPath, source, mtimeMs: stat.mtimeMs };
      });
  };
  const files = collectFromDir(STATE_BACKUP_DIR, "primary").concat(
    collectFromDir(STATE_BACKUP_BACKUP_DIR, "secondary")
  );
  if (!files.length) return { data: {}, source: null, name: null, updatedAt: null };
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = files[0];
  const envelope = readJsonFileSafe(latest.fullPath, null);
  return {
    data: extractStateData(envelope),
    source: latest.source,
    name: latest.name,
    updatedAt: envelope && envelope.updatedAt ? String(envelope.updatedAt) : null,
  };
}

function deriveProfileFromState(stateData) {
  const state = toObject(stateData);
  const appMeta = toObject(state.appMeta);
  const user = toObject(state.user);
  const profile = toObject(state.profile);
  const settings = toObject(state.settings);
  return sanitizeForAgent({
    name: pickString(
      profile.name,
      user.name,
      appMeta.userName,
      appMeta.owner,
      settings.userName
    ),
    timezone: pickString(
      settings.timezone,
      appMeta.timezone,
      profile.timezone,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ),
    focusAreas: Array.isArray(profile.focusAreas) ? profile.focusAreas.slice(0, 20) : [],
    preferences: toObject(profile.preferences),
    notes: pickString(profile.notes, user.notes),
  });
}

function loadUserProfileEnvelope() {
  ensureDataDir();
  const raw = readJsonFileSafe(USER_PROFILE_FILE, null);
  if (raw && typeof raw === "object" && raw.profile && typeof raw.profile === "object") {
    return raw;
  }
  if (raw && typeof raw === "object") {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      profile: raw,
      readOnlyForLLM: true,
    };
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: {},
    readOnlyForLLM: true,
  };
}

function saveUserProfileEnvelope(envelope) {
  ensureDataDir();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    readOnlyForLLM: true,
    profile: toObject(envelope && envelope.profile),
  };
  fs.writeFileSync(USER_PROFILE_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function toEpochMs(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function priorityRank(value) {
  const key = String(value || "").toUpperCase();
  if (key === "P0") return 0;
  if (key === "P1") return 1;
  if (key === "P2") return 2;
  if (key === "P3") return 3;
  return 9;
}

function detectIntent(question) {
  const q = String(question || "").toLowerCase();
  if (/\b(calendar|week|day|schedule|event|meeting)\b/.test(q)) return "calendar";
  if (/\b(project|learning|milestone|roadmap)\b/.test(q)) return "projects";
  if (/\b(task|todo|pending|due|overdue|priority)\b/.test(q)) return "tasks";
  if (/\b(habit|streak)\b/.test(q)) return "habits";
  if (/\b(journal|note)\b/.test(q)) return "journal";
  return "general";
}

function pickArray(stateData, keys) {
  const state = toObject(stateData);
  for (let i = 0; i < keys.length; i += 1) {
    const value = state[keys[i]];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function mapTaskForAgent(task) {
  const t = toObject(task);
  return {
    id: t.id || "",
    title: t.title || "",
    due: t.due || "",
    priority: t.priority || "",
    done: Boolean(t.done),
    tags: Array.isArray(t.tags) ? t.tags.slice(0, 6) : [],
  };
}

function getTaskSlice(stateData, intent) {
  const tasks = pickArray(stateData, ["todoTasks", "tasks"]).map(mapTaskForAgent);
  const pending = tasks.filter((t) => !t.done);
  pending.sort((a, b) => {
    const dueDelta = toEpochMs(a.due) - toEpochMs(b.due);
    if (dueDelta !== 0) return dueDelta;
    return priorityRank(a.priority) - priorityRank(b.priority);
  });
  const done = tasks.filter((t) => t.done).slice(0, Math.min(6, AGENT_RETRIEVAL_ITEM_LIMIT));
  const limit = intent === "tasks" ? AGENT_RETRIEVAL_ITEM_LIMIT : Math.min(8, AGENT_RETRIEVAL_ITEM_LIMIT);
  return {
    pending: pending.slice(0, limit),
    doneRecent: done,
    totalTasks: tasks.length,
    pendingCount: pending.length,
  };
}

function mapCalendarItem(item) {
  const e = toObject(item);
  return {
    id: e.id || "",
    title: e.title || e.name || "",
    start: e.start || e.startDate || e.date || "",
    end: e.end || e.endDate || "",
    due: e.due || "",
    type: e.type || "",
  };
}

function getCalendarSlice(stateData, intent) {
  const events = pickArray(stateData, ["calendarItems", "calendarEntries", "calendarTasks", "weekItems"])
    .map(mapCalendarItem);
  events.sort((a, b) => toEpochMs(a.start || a.due) - toEpochMs(b.start || b.due));
  const limit = intent === "calendar" ? AGENT_RETRIEVAL_ITEM_LIMIT : Math.min(8, AGENT_RETRIEVAL_ITEM_LIMIT);
  return {
    upcoming: events.slice(0, limit),
    totalEvents: events.length,
  };
}

function mapProjectForAgent(item) {
  const p = toObject(item);
  return {
    id: p.id || "",
    type: p.type || "",
    title: p.title || "",
    startDate: p.startDate || "",
    endDate: p.endDate || "",
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 6) : [],
  };
}

function getProjectSlice(stateData, intent) {
  const entries = pickArray(stateData, ["dashboardEntries", "projects"]).map(mapProjectForAgent);
  const active = entries.filter((p) => String(p.type || "").toLowerCase() === "project" || String(p.type || "").toLowerCase() === "learning");
  active.sort((a, b) => toEpochMs(a.endDate) - toEpochMs(b.endDate));
  const limit = intent === "projects" ? Math.min(12, AGENT_RETRIEVAL_ITEM_LIMIT) : Math.min(6, AGENT_RETRIEVAL_ITEM_LIMIT);
  return {
    active: active.slice(0, limit),
    totalEntries: entries.length,
  };
}

function getHabitSlice(stateData) {
  const habits = pickArray(stateData, ["hobbyTracker", "habits"]).map((h) => toObject(h));
  return {
    top: habits.slice(0, Math.min(10, AGENT_RETRIEVAL_ITEM_LIMIT)),
    total: habits.length,
  };
}

function getJournalSlice(stateData) {
  const journal = pickArray(stateData, ["journalEntries"]).map((j) => toObject(j));
  return {
    recent: journal.slice(0, Math.min(8, AGENT_RETRIEVAL_ITEM_LIMIT)),
    total: journal.length,
  };
}

function buildRelevantSlices(stateData, intent) {
  if (intent === "tasks") return { tasks: getTaskSlice(stateData, intent) };
  if (intent === "calendar") return { calendar: getCalendarSlice(stateData, intent) };
  if (intent === "projects") return { projects: getProjectSlice(stateData, intent) };
  if (intent === "habits") return { habits: getHabitSlice(stateData) };
  if (intent === "journal") return { journal: getJournalSlice(stateData) };
  return {
    tasks: getTaskSlice(stateData, intent),
    calendar: getCalendarSlice(stateData, intent),
    projects: getProjectSlice(stateData, intent),
  };
}

function buildAgentContextForQuestion(question) {
  const currentState = loadServerState();
  const backup = loadLatestBackupState();
  const stateData = Object.keys(currentState).length ? currentState : toObject(backup.data);
  const intent = detectIntent(question);

  const existingProfileEnvelope = loadUserProfileEnvelope();
  const derivedProfile = deriveProfileFromState(stateData);
  const mergedProfile = {
    ...derivedProfile,
    ...toObject(existingProfileEnvelope.profile),
  };
  const storedProfile = saveUserProfileEnvelope({ profile: mergedProfile });

  const stateKeys = Object.keys(toObject(stateData));
  const sectionCounts = {};
  stateKeys.slice(0, 80).forEach((key) => {
    const value = stateData[key];
    if (Array.isArray(value)) sectionCounts[key] = value.length;
  });
  const relevant = buildRelevantSlices(stateData, intent);

  return sanitizeForAgent({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    profileFile: path.basename(USER_PROFILE_FILE),
    profile: storedProfile.profile,
    stateSource: Object.keys(currentState).length
      ? "server_state.json"
      : backup.name
        ? `${backup.source}:${backup.name}`
        : "none",
    stateUpdatedAt: backup.updatedAt || null,
    intent,
    stateKeys,
    sectionCounts,
    relevant,
  });
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

  if (pathname === "/api/state/backups" && req.method === "GET") {
    const backups = listAllBackups();
    return send(res, 200, backups);
  }

  if (pathname === "/api/state/backups/restore" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const name = typeof payload.name === "string" ? payload.name : "";
      const source = payload.source === "secondary" ? "secondary" : "primary";
      const envelope = readBackupEnvelope(name, source);
      if (!envelope) return send(res, 400, { error: "invalid_backup" });
      forceBackupCurrentState();
      const data = extractStateData(envelope);
      saveServerState(data);
      return send(res, 200, { ok: true, restored: name, source });
    } catch (err) {
      return send(res, 400, { error: "restore_failed" });
    }
  }

  if (pathname === "/api/state/backups/upload" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const envelope = normalizeBackupEnvelope(payload.backup);
      if (!envelope) return send(res, 400, { error: "invalid_backup_payload" });
      const backupName = writeUploadedBackup(payload.name, envelope);
      return send(res, 200, { ok: true, uploaded: backupName });
    } catch (err) {
      return send(res, 400, { error: "upload_failed" });
    }
  }

  if (pathname === "/api/agent/health" && req.method === "GET") {
    try {
      const { response, base } = await fetchFromOllama("/api/tags");
      if (!response.ok) return send(res, 502, { ok: false, error: "ollama_unavailable" });
      const payload = await response.json();
      const modelNames = Array.isArray(payload.models) ? payload.models.map((m) => m.name) : [];
      const modelAvailable = modelNames.includes(AGENT_MODEL);
      return send(res, 200, {
        ok: true,
        agentVersion: AGENT_VERSION,
        model: AGENT_MODEL,
        modelAvailable,
        base,
        detail: modelAvailable ? "ready" : `model_missing:${AGENT_MODEL}`,
      });
    } catch (err) {
      return send(res, 502, {
        ok: false,
        error: "ollama_unavailable",
        detail: err && err.message ? truncateString(err.message, 400) : "unreachable",
      });
    }
  }

  if (pathname === "/api/agent/chat" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const question = String(payload.question || "").trim();
      if (!question) return send(res, 400, { error: "missing_question" });
      const context = buildAgentContextForQuestion(question);

      const systemPrompt =
        "You are a local assistant for a personal dashboard. You have read-only access to dashboard context. " +
        "Never claim to modify files, server state, or tasks directly. Provide guidance only. " +
        "Use the provided dashboard context first, including user_name.json profile and server_state backup snapshot. " +
        "Be concise and actionable. Keep answers under 6 short bullet points unless asked for detail. " +
        "If data is missing, say what is missing.";

      const contextVariants = [
        JSON.stringify(context).slice(0, AGENT_PROMPT_CONTEXT_LIMIT),
        JSON.stringify({ generatedAt: new Date().toISOString(), page: context.page || "", data: {} }),
      ];

      let lastError = null;
      for (let attempt = 0; attempt < contextVariants.length; attempt += 1) {
        const attemptTimeout = attempt === 0 ? AGENT_TIMEOUT_MS : Math.max(AGENT_TIMEOUT_MS, 120000);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);
        const userPrompt = [
          "Dashboard context JSON:",
          contextVariants[attempt],
          "",
          `Question: ${question}`,
        ].join("\n");

        try {
          const { response, base } = await fetchFromOllama("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: AGENT_MODEL,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: false,
              keep_alive: AGENT_KEEP_ALIVE,
              options: {
                num_predict: AGENT_MAX_PREDICT,
              },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const body = await response.text();
            return send(res, 502, {
              error: "agent_unavailable",
              detail: truncateString(body || "Ollama returned an error", 400),
              agentVersion: AGENT_VERSION,
            });
          }

          const result = await response.json();
          const reply = result && result.message && result.message.content ? result.message.content : "";
          if (!reply) {
            lastError = new Error("empty_reply");
            continue;
          }
          return send(res, 200, {
            reply,
            model: AGENT_MODEL,
            source: "ollama",
            base,
            agentVersion: AGENT_VERSION,
            attempt: attempt + 1,
          });
        } catch (err) {
          clearTimeout(timeoutId);
          lastError = err;
          if (!(err && err.name === "AbortError")) {
            break;
          }
        }
      }

      if (lastError && lastError.name === "AbortError") {
        return send(res, 504, {
          error: "agent_timeout",
          detail: `Agent timed out after retries. Base timeout ${AGENT_TIMEOUT_MS}ms.`,
          agentVersion: AGENT_VERSION,
        });
      }
      throw lastError || new Error("agent_failed");
    } catch (err) {
      return send(res, 502, {
        error: "agent_unavailable",
        agentVersion: AGENT_VERSION,
        detail: err && err.message
          ? truncateString(err.message, 400)
          : "Ollama reachable check failed",
      });
    }
  }

  if (serveStatic(req, res)) return;
  send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`Dashboard server running on http://0.0.0.0:${PORT}`);
});
