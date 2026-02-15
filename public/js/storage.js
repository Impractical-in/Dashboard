const STORAGE_DB = "dashboard_store";
const STORAGE_STORE = "kv";
const META_KEY = "appMeta";
const APP_VERSION = "0.2.0";
const SERVER_STATE_ENDPOINT = "/api/state";

let storageReady = false;
let storageInitPromise = null;
let metaUpdateInProgress = false;
let serverPushTimer = null;
let serverPushInFlight = false;
let suppressServerPush = false;

function canUseServerStateSync() {
  if (typeof window === "undefined" || !window.location) return false;
  const protocol = String(window.location.protocol || "").toLowerCase();
  return protocol === "http:" || protocol === "https:";
}

if (typeof window !== "undefined") {
  window.APP_VERSION = APP_VERSION;
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

if (typeof window !== "undefined") {
  window.generateId = generateId;
}

function loadData(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (storageReady) {
    idbSet(key, value);
  }
  if (key !== META_KEY) updateMeta();
  if (storageReady && !suppressServerPush && canUseServerStateSync()) queueServerPush();
  if (typeof window !== "undefined" && typeof window.onDataSaved === "function") {
    window.onDataSaved();
  }
}

function updateMeta() {
  if (metaUpdateInProgress) return;
  metaUpdateInProgress = true;
  const meta = {
    version: APP_VERSION,
    lastSavedAt: new Date().toISOString(),
  };
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  if (storageReady) {
    idbSet(META_KEY, meta);
  }
  if (storageReady && !suppressServerPush && canUseServerStateSync()) queueServerPush();
  metaUpdateInProgress = false;
}

function getStoredValue(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function setIfEmpty(key, value, isEmptyFn) {
  const stored = getStoredValue(key);
  if (stored === null) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  if (isEmptyFn && isEmptyFn(stored)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

const RESET_KEYS = [
  "todoTasks",
  "todoArchive",
  "dashboardEntries",
  "hobbyTracker",
  "journalEntries",
  "quickLinks",
  "localPomodoroLogs",
  "ganttZoom",
];

function resetIfRequested() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("reset")) return;
  RESET_KEYS.forEach((key) => localStorage.removeItem(key));
  if (typeof indexedDB !== "undefined") {
    try {
      indexedDB.deleteDatabase(STORAGE_DB);
    } catch (err) {
      // Ignore reset failures to avoid blocking init.
    }
  }
}

function initStorage() {
  if (storageInitPromise) return storageInitPromise;
  storageInitPromise = (async () => {
    resetIfRequested();
    const localBeforeServer = buildStateSnapshot();
    if (typeof indexedDB !== "undefined") {
      try {
        const db = await openDb();
        await syncLocalStorage(db);
      } catch (err) {
        // Continue without blocking init.
      }
    }
    if (canUseServerStateSync()) {
      try {
        const serverData = await fetchStateFromServer();
        const serverHasData = Object.keys(serverData).length > 0;
        const localHasData = Object.keys(localBeforeServer).length > 0;
        if (serverHasData) {
          applyServerState(serverData);
        } else if (localHasData) {
          await postStateToServer(localBeforeServer);
        }
      } catch (err) {
        // If server is unavailable, keep current local cache.
      }
    }
    storageReady = true;
  })();
  return storageInitPromise;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORAGE_STORE)) {
        db.createObjectStore(STORAGE_STORE);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getLocalKeys() {
  return Object.keys(localStorage).filter((key) => !key.startsWith("__"));
}

function isLocalStorageEmpty() {
  return getLocalKeys().length === 0;
}

function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORAGE_STORE, "readonly");
    const store = tx.objectStore(STORAGE_STORE);
    const request = store.getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const keys = request.result || [];
      const valuesRequest = store.getAll();
      valuesRequest.onerror = () => reject(valuesRequest.error);
      valuesRequest.onsuccess = () => {
        const values = valuesRequest.result || [];
        const map = new Map();
        keys.forEach((key, index) => {
          map.set(key, values[index]);
        });
        resolve(map);
      };
    };
  });
}

function idbSet(key, value) {
  openDb()
    .then((db) => {
      const tx = db.transaction(STORAGE_STORE, "readwrite");
      tx.objectStore(STORAGE_STORE).put(value, key);
    })
    .catch(() => {});
}

function syncLocalStorage(db) {
  if (isLocalStorageEmpty()) {
    return idbGetAll(db).then((map) => {
      map.forEach((value, key) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORAGE_STORE, "readwrite");
    const store = tx.objectStore(STORAGE_STORE);
    getLocalKeys().forEach((key) => {
      const value = loadData(key, null);
      store.put(value, key);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function parseLocalValue(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function buildStateSnapshot() {
  const data = {};
  getLocalKeys().forEach((key) => {
    data[key] = parseLocalValue(key);
  });
  return data;
}

function applyServerState(data) {
  suppressServerPush = true;
  getLocalKeys().forEach((key) => localStorage.removeItem(key));
  Object.entries(data || {}).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
    if (storageReady) idbSet(key, value);
  });
  suppressServerPush = false;
}

async function fetchStateFromServer() {
  if (!canUseServerStateSync()) return {};
  const response = await fetch(SERVER_STATE_ENDPOINT);
  if (!response.ok) throw new Error("state_pull_failed");
  const payload = await response.json();
  return payload && payload.data && typeof payload.data === "object" ? payload.data : {};
}

async function postStateToServer(data) {
  if (!canUseServerStateSync()) return;
  const response = await fetch(SERVER_STATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, data }),
  });
  if (!response.ok) throw new Error("state_push_failed");
}

async function pushStateToServer() {
  if (serverPushInFlight || !storageReady || suppressServerPush || !canUseServerStateSync()) return;
  serverPushInFlight = true;
  try {
    const data = buildStateSnapshot();
    await postStateToServer(data);
  } catch (err) {
    // Non-fatal: next save will retry.
  } finally {
    serverPushInFlight = false;
  }
}

function queueServerPush() {
  if (serverPushTimer) clearTimeout(serverPushTimer);
  serverPushTimer = setTimeout(() => {
    pushStateToServer().catch(() => {});
  }, 350);
}

