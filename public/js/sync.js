const connectBtn = document.getElementById("connectBtn");
const backupBtn = document.getElementById("backupBtn");
const restoreBtn = document.getElementById("restoreBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const syncStatus = document.getElementById("syncStatus");
const syncSuccess = document.getElementById("syncSuccess");
const autoBackupToggle = document.getElementById("autoBackup");
const backupInterval = document.getElementById("backupInterval");
const localStatus = document.getElementById("localStatus");
const localSuccess = document.getElementById("localSuccess");
const chooseLocalFileBtn = document.getElementById("chooseLocalFileBtn");
const localSaveBtn = document.getElementById("localSaveBtn");
const localAutoToggle = document.getElementById("localAutoBackup");
const localInterval = document.getElementById("localBackupInterval");
const lastSavedLabel = document.getElementById("lastSavedLabel");
const lastBackupLabel = document.getElementById("lastBackupLabel");
const serverStatus = document.getElementById("serverStatus");
const serverUrlInput = document.getElementById("serverUrl");
const serverTokenInput = document.getElementById("serverToken");
const serverSyncToggle = document.getElementById("serverSyncToggle");
const serverPullBtn = document.getElementById("serverPullBtn");
const serverPushBtn = document.getElementById("serverPushBtn");

const OAUTH_CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILENAME = "dashboard-backup.json";
const TOKEN_KEY = "gdriveAccessToken";
const FILE_ID_KEY = "gdriveBackupFileId";
const LAST_BACKUP_KEY = "gdriveLastBackup";
const AUTO_ENABLED_KEY = "gdriveAutoEnabled";
const AUTO_INTERVAL_KEY = "gdriveAutoIntervalHours";
const LOCAL_AUTO_ENABLED_KEY = "localAutoEnabled";
const LOCAL_AUTO_INTERVAL_KEY = "localAutoIntervalHours";
const LOCAL_LAST_SNAPSHOT_KEY = "localLastSnapshot";
const SERVER_SYNC_ENABLED_KEY = "serverSyncEnabled";
const SERVER_URL_KEY = "serverSyncUrl";
const SERVER_TOKEN_KEY = "serverSyncToken";

let tokenClient = null;
let accessToken = null;
let pendingAutoBackup = false;
let localHandle = null;
let suppressServerSync = false;
let serverSyncTimer = null;

function updateStatus(message) {
  if (syncStatus) syncStatus.textContent = message;
}

function updateLocalStatus(message) {
  if (localStatus) localStatus.textContent = message;
}

function updateServerStatus(message) {
  if (serverStatus) serverStatus.textContent = message;
}

function updateLastLabels() {
  const lastLocal = localStorage.getItem(LOCAL_LAST_SNAPSHOT_KEY);
  if (lastSavedLabel) {
    lastSavedLabel.textContent = lastLocal ? new Date(lastLocal).toLocaleString() : "Never";
  }
  if (lastBackupLabel) {
    lastBackupLabel.textContent = lastLocal ? new Date(lastLocal).toLocaleString() : "Never";
  }
}

function showSuccess(el) {
  if (!el) return;
  el.hidden = false;
  clearTimeout(el.dataset.timerId);
  const timerId = window.setTimeout(() => {
    el.hidden = true;
  }, 2500);
  el.dataset.timerId = String(timerId);
}

function getLocalKeys() {
  return Object.keys(localStorage).filter((key) => !key.startsWith("__"));
}

async function buildSnapshot() {
  const meta = loadData("appMeta", {});
  const data = {};
  getLocalKeys().forEach((key) => {
    data[key] = loadData(key, null);
  });
  const payload = {
    version: 1,
    appVersion: meta.version || (typeof window !== "undefined" ? window.APP_VERSION : ""),
    lastSavedAt: meta.lastSavedAt || null,
    exportedAt: new Date().toISOString(),
    data,
  };
  return payload;
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dashboard_sync", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function saveHandle(handle) {
  return openHandleDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "backup");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function loadHandle() {
  return openHandleDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("backup");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

async function ensureHandlePermission(handle) {
  if (!handle) return false;
  if (handle.queryPermission) {
    const status = await handle.queryPermission({ mode: "readwrite" });
    if (status === "granted") return true;
  }
  if (handle.requestPermission) {
    const status = await handle.requestPermission({ mode: "readwrite" });
    return status === "granted";
  }
  return false;
}

async function chooseLocalFile() {
  if (!window.showSaveFilePicker) {
    updateLocalStatus("This browser does not support local auto backup.");
    return;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: "dashboard-backup.json",
    types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
  });
  localHandle = handle;
  await saveHandle(handle);
  updateLocalStatus("Backup file selected");
}

async function writeSnapshotToHandle(handle, snapshot) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(snapshot, null, 2));
  await writable.close();
  localStorage.setItem(LOCAL_LAST_SNAPSHOT_KEY, snapshot.exportedAt);
  updateLocalStatus(`Last snapshot: ${new Date(snapshot.exportedAt).toLocaleString()}`);
  updateLastLabels();
}

async function localSaveNow() {
  if (!localHandle) {
    updateLocalStatus("Choose a backup file first.");
    return;
  }
  const ok = await ensureHandlePermission(localHandle);
  if (!ok) {
    updateLocalStatus("Permission denied.");
    return;
  }
  const snapshot = await buildSnapshot();
  await writeSnapshotToHandle(localHandle, snapshot);
  showSuccess(localSuccess);
}

async function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.data) return false;
  suppressServerSync = true;
  const incomingKeys = new Set(Object.keys(snapshot.data));
  getLocalKeys().forEach((key) => {
    if (!incomingKeys.has(key)) {
      localStorage.removeItem(key);
    }
  });
  Object.entries(snapshot.data).forEach(([key, value]) => {
    saveData(key, value);
  });
  suppressServerSync = false;
  return true;
}

function getToken() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;
  return null;
}

function setToken(token) {
  accessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
}

function initTokenClient() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response && response.access_token) {
        setToken(response.access_token);
        updateStatus("Connected (token active)");
        if (pendingAutoBackup) {
          pendingAutoBackup = false;
          backupNow().catch(() => updateStatus("Backup failed"));
        }
      }
    },
  });
}

function requireToken() {
  if (accessToken) return Promise.resolve(accessToken);
  const stored = getToken();
  if (stored) {
    accessToken = stored;
    return Promise.resolve(stored);
  }
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("Token client not ready"));
    tokenClient.callback = (response) => {
      if (response && response.access_token) {
        setToken(response.access_token);
        updateStatus("Connected (token active)");
        resolve(response.access_token);
      } else {
        reject(new Error("No access token"));
      }
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

function buildMultipartBody(metadata, content) {
  const boundary = "boundary" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;
  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(content) +
    close;
  return { body, boundary };
}

async function findBackupFile(token) {
  const fileId = localStorage.getItem(FILE_ID_KEY);
  if (fileId) return fileId;
  const query = encodeURIComponent(`name='${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false`);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,modifiedTime)` ,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  const file = data.files && data.files[0];
  if (file && file.id) {
    localStorage.setItem(FILE_ID_KEY, file.id);
    return file.id;
  }
  return null;
}

async function createBackupFile(token, snapshot) {
  const metadata = { name: BACKUP_FILENAME, parents: ["appDataFolder"] };
  const { body, boundary } = buildMultipartBody(metadata, snapshot);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) throw new Error("Create failed");
  const result = await response.json();
  if (result.id) localStorage.setItem(FILE_ID_KEY, result.id);
  return result.id;
}

async function updateBackupFile(token, fileId, snapshot) {
  const metadata = { name: BACKUP_FILENAME };
  const { body, boundary } = buildMultipartBody(metadata, snapshot);
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!response.ok) throw new Error("Update failed");
}

async function backupNow() {
  const token = await requireToken();
  const snapshot = await buildSnapshot();
  let fileId = await findBackupFile(token);
  if (!fileId) {
    fileId = await createBackupFile(token, snapshot);
  } else {
    try {
      await updateBackupFile(token, fileId, snapshot);
    } catch (err) {
      localStorage.removeItem(FILE_ID_KEY);
      const fallbackId = await createBackupFile(token, snapshot);
      fileId = fallbackId;
    }
  }
  localStorage.setItem(LAST_BACKUP_KEY, snapshot.exportedAt);
  updateStatus(`Backed up: ${new Date(snapshot.exportedAt).toLocaleString()}`);
  showSuccess(syncSuccess);
}

async function downloadSnapshot(token, fileId) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Download failed");
  return response.json();
}

async function restoreNow() {
  const token = await requireToken();
  let fileId = await findBackupFile(token);
  if (!fileId) throw new Error("Backup file not found");
  const snapshot = await downloadSnapshot(token, fileId);
  const applied = await applySnapshot(snapshot);
  if (!applied) throw new Error("Invalid snapshot");
  updateStatus("Restore complete");
}

async function exportToFile() {
  const snapshot = await buildSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  link.href = url;
  link.download = `dashboard_backup_${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const snapshot = JSON.parse(reader.result);
      initStorage().then(async () => {
        const applied = await applySnapshot(snapshot);
        if (applied) updateStatus("Import complete");
      });
    } catch (err) {
      updateStatus("Import failed");
    }
  };
  reader.readAsText(file);
}

function initAutoBackup() {
  const enabled = localStorage.getItem(AUTO_ENABLED_KEY) === "true";
  const intervalHours = Number(localStorage.getItem(AUTO_INTERVAL_KEY) || backupInterval.value);
  autoBackupToggle.checked = enabled;
  backupInterval.value = String(intervalHours);

  if (enabled) {
    scheduleAutoBackup(intervalHours);
  }
}

function scheduleAutoBackup(hours) {
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000;
  setInterval(() => {
    if (autoBackupToggle.checked) {
      backupNow().catch(() => {});
    }
  }, intervalMs);
}

function scheduleLocalAutoBackup(hours) {
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000;
  setInterval(() => {
    if (localAutoToggle && localAutoToggle.checked) {
      localSaveNow().catch(() => {});
    }
  }, intervalMs);
}

function getServerConfig() {
  const url =
    (serverUrlInput && serverUrlInput.value.trim()) ||
    localStorage.getItem(SERVER_URL_KEY) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "";
  const token = (serverTokenInput && serverTokenInput.value.trim()) || localStorage.getItem(SERVER_TOKEN_KEY) || "";
  return { url, token };
}

function persistServerConfig() {
  if (!serverUrlInput || !serverTokenInput) return;
  localStorage.setItem(SERVER_URL_KEY, serverUrlInput.value.trim());
  localStorage.setItem(SERVER_TOKEN_KEY, serverTokenInput.value.trim());
}

async function pullFromServer() {
  const { url, token } = getServerConfig();
  if (!url) {
    updateServerStatus("Missing server URL");
    return;
  }
  const response = await fetch(`${url.replace(/\/$/, "")}/api/data`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    updateServerStatus("Pull failed");
    return;
  }
  const snapshot = await response.json();
  const applied = await applySnapshot(snapshot);
  updateServerStatus(applied ? "Pulled from server" : "Pull failed");
}

async function pushToServer() {
  const { url, token } = getServerConfig();
  if (!url) {
    updateServerStatus("Missing server URL");
    return;
  }
  const snapshot = await buildSnapshot();
  const response = await fetch(`${url.replace(/\/$/, "")}/api/data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(snapshot),
  });
  updateServerStatus(response.ok ? "Pushed to server" : "Push failed");
}

function queueServerPush() {
  if (!serverSyncToggle || !serverSyncToggle.checked) return;
  if (suppressServerSync) return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    pushToServer().catch(() => updateServerStatus("Push failed"));
  }, 1200);
}

if (connectBtn) {
  connectBtn.addEventListener("click", () => {
    pendingAutoBackup = true;
    requireToken().catch(() => updateStatus("Connection failed"));
  });
}

if (backupBtn) {
  backupBtn.addEventListener("click", () => {
    backupNow().catch(() => updateStatus("Backup failed"));
  });
}

if (restoreBtn) {
  restoreBtn.addEventListener("click", () => {
    restoreNow().catch(() => updateStatus("Restore failed"));
  });
}

exportBtn.addEventListener("click", exportToFile);
importInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) importFromFile(file);
});

if (chooseLocalFileBtn) {
  chooseLocalFileBtn.addEventListener("click", () => {
    chooseLocalFile().catch(() => updateLocalStatus("File selection failed"));
  });
}

if (localSaveBtn) {
  localSaveBtn.addEventListener("click", () => {
    localSaveNow().catch(() => updateLocalStatus("Snapshot failed"));
  });
}

if (localAutoToggle) {
  localAutoToggle.addEventListener("change", () => {
    localStorage.setItem(LOCAL_AUTO_ENABLED_KEY, String(localAutoToggle.checked));
    if (localAutoToggle.checked) {
      scheduleLocalAutoBackup(Number(localInterval.value));
    }
  });
}

if (localInterval) {
  localInterval.addEventListener("change", () => {
    localStorage.setItem(LOCAL_AUTO_INTERVAL_KEY, localInterval.value);
  });
}

  if (serverUrlInput) {
    serverUrlInput.addEventListener("change", () => {
      persistServerConfig();
    });
  }

if (serverTokenInput) {
  serverTokenInput.addEventListener("change", () => {
    persistServerConfig();
  });
}

if (serverSyncToggle) {
  serverSyncToggle.addEventListener("change", () => {
    localStorage.setItem(SERVER_SYNC_ENABLED_KEY, String(serverSyncToggle.checked));
    updateServerStatus(serverSyncToggle.checked ? "Enabled" : "Disabled");
    if (serverSyncToggle.checked) {
      pullFromServer().catch(() => updateServerStatus("Pull failed"));
    }
  });
}

if (serverPullBtn) {
  serverPullBtn.addEventListener("click", () => {
    pullFromServer().catch(() => updateServerStatus("Pull failed"));
  });
}

if (serverPushBtn) {
  serverPushBtn.addEventListener("click", () => {
    pushToServer().catch(() => updateServerStatus("Push failed"));
  });
}

if (typeof window !== "undefined") {
  window.onDataSaved = queueServerPush;
}

if (autoBackupToggle) {
  autoBackupToggle.addEventListener("change", () => {
    localStorage.setItem(AUTO_ENABLED_KEY, String(autoBackupToggle.checked));
    if (autoBackupToggle.checked) {
      scheduleAutoBackup(Number(backupInterval.value));
    }
  });
}

if (backupInterval) {
  backupInterval.addEventListener("change", () => {
    localStorage.setItem(AUTO_INTERVAL_KEY, backupInterval.value);
  });
}

initStorage().then(() => {
  initTokenClient();
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (lastBackup) {
    updateStatus(`Last backup: ${new Date(lastBackup).toLocaleString()}`);
  }
  initAutoBackup();
  const storedToken = getToken();
  if (storedToken) {
    accessToken = storedToken;
    restoreNow().catch(() => {});
  }
  if (localAutoToggle && localInterval) {
    const localEnabled = localStorage.getItem(LOCAL_AUTO_ENABLED_KEY) === "true";
    const localHours = Number(localStorage.getItem(LOCAL_AUTO_INTERVAL_KEY) || localInterval.value);
    localAutoToggle.checked = localEnabled;
    localInterval.value = String(localHours);
    scheduleLocalAutoBackup(localHours);
  }
  updateLastLabels();
  loadHandle()
    .then((handle) => {
      if (handle) {
        localHandle = handle;
        updateLocalStatus("Backup file ready");
      }
    })
    .catch(() => {});

  if (serverUrlInput && serverTokenInput && serverSyncToggle) {
    const storedUrl = localStorage.getItem(SERVER_URL_KEY);
    const storedToken = localStorage.getItem(SERVER_TOKEN_KEY);
    const storedEnabled = localStorage.getItem(SERVER_SYNC_ENABLED_KEY) === "true";
    if (storedUrl) serverUrlInput.value = storedUrl;
    if (!storedUrl && typeof window !== "undefined") {
      serverUrlInput.value = window.location.origin;
      persistServerConfig();
    }
    if (storedToken) serverTokenInput.value = storedToken;
    serverSyncToggle.checked = storedEnabled;
    updateServerStatus(storedEnabled ? "Enabled" : "Disabled");
    if (storedEnabled) {
      pullFromServer().catch(() => updateServerStatus("Pull failed"));
    }
  }
});
