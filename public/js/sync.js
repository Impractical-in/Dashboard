const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const localStatus = document.getElementById("localStatus");
const localSuccess = document.getElementById("localSuccess");
const chooseLocalFileBtn = document.getElementById("chooseLocalFileBtn");
const localSaveBtn = document.getElementById("localSaveBtn");
const localRestoreBtn = document.getElementById("localRestoreBtn");
const localAutoToggle = document.getElementById("localAutoBackup");
const localInterval = document.getElementById("localBackupInterval");
const lastSavedLabel = document.getElementById("lastSavedLabel");
const lastBackupLabel = document.getElementById("lastBackupLabel");

const LOCAL_AUTO_ENABLED_KEY = "localAutoEnabled";
const LOCAL_AUTO_INTERVAL_KEY = "localAutoIntervalHours";
const LOCAL_LAST_SNAPSHOT_KEY = "localLastSnapshot";

let localHandle = null;
let localAutoTimer = null;
let saveDebounceTimer = null;

function updateLocalStatus(message) {
  if (localStatus) localStatus.textContent = message;
}

function updateLastLabels() {
  const lastLocal = localStorage.getItem(LOCAL_LAST_SNAPSHOT_KEY);
  const value = lastLocal ? new Date(lastLocal).toLocaleString() : "Never";
  if (lastSavedLabel) lastSavedLabel.textContent = value;
  if (lastBackupLabel) lastBackupLabel.textContent = value;
}

function showSuccess(el) {
  if (!el) return;
  el.hidden = false;
  clearTimeout(Number(el.dataset.timerId || 0));
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
  return {
    version: 1,
    appVersion: meta.version || (typeof window !== "undefined" ? window.APP_VERSION : ""),
    lastSavedAt: meta.lastSavedAt || null,
    exportedAt: new Date().toISOString(),
    data,
  };
}

async function applySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.data) return false;
  const incomingKeys = new Set(Object.keys(snapshot.data));
  getLocalKeys().forEach((key) => {
    if (!incomingKeys.has(key)) localStorage.removeItem(key);
  });
  Object.entries(snapshot.data).forEach(([key, value]) => {
    saveData(key, value);
  });
  return true;
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

async function hasReadWritePermission(handle) {
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

async function hasReadPermission(handle) {
  if (!handle) return false;
  if (handle.queryPermission) {
    const status = await handle.queryPermission({ mode: "read" });
    if (status === "granted") return true;
  }
  if (handle.requestPermission) {
    const status = await handle.requestPermission({ mode: "read" });
    return status === "granted";
  }
  return false;
}

async function chooseLocalFile() {
  if (!window.showSaveFilePicker) {
    updateLocalStatus("This browser does not support file-backed backup.");
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
  const ok = await hasReadWritePermission(localHandle);
  if (!ok) {
    updateLocalStatus("Permission denied.");
    return;
  }
  const snapshot = await buildSnapshot();
  await writeSnapshotToHandle(localHandle, snapshot);
  showSuccess(localSuccess);
}

async function restoreFromHandle() {
  if (!localHandle) {
    updateLocalStatus("Choose a backup file first.");
    return;
  }
  const ok = await hasReadPermission(localHandle);
  if (!ok) {
    updateLocalStatus("Read permission denied.");
    return;
  }
  const file = await localHandle.getFile();
  const text = await file.text();
  const snapshot = JSON.parse(text);
  const applied = await applySnapshot(snapshot);
  if (!applied) {
    updateLocalStatus("Invalid snapshot file.");
    return;
  }
  updateLocalStatus("Restore complete");
}

async function exportToFile() {
  const snapshot = await buildSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `dashboard_backup_${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const snapshot = JSON.parse(String(reader.result || ""));
      const applied = await applySnapshot(snapshot);
      updateLocalStatus(applied ? "Import complete" : "Import failed");
    } catch (err) {
      updateLocalStatus("Import failed");
    }
  };
  reader.readAsText(file);
}

function scheduleLocalAutoBackup(hours) {
  if (localAutoTimer) clearInterval(localAutoTimer);
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000;
  localAutoTimer = setInterval(() => {
    if (localAutoToggle && localAutoToggle.checked) {
      localSaveNow().catch(() => {});
    }
  }, intervalMs);
}

function queueLocalSave() {
  if (!localAutoToggle || !localAutoToggle.checked) return;
  if (!localHandle) return;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    localSaveNow().catch(() => {});
  }, 1500);
}

exportBtn.addEventListener("click", () => {
  exportToFile().catch(() => updateLocalStatus("Export failed"));
});

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

if (localRestoreBtn) {
  localRestoreBtn.addEventListener("click", () => {
    restoreFromHandle().catch(() => updateLocalStatus("Restore failed"));
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
    if (localAutoToggle && localAutoToggle.checked) {
      scheduleLocalAutoBackup(Number(localInterval.value));
    }
  });
}

if (typeof window !== "undefined") {
  window.onDataSaved = queueLocalSave;
}

initStorage().then(() => {
  if (localAutoToggle && localInterval) {
    const localEnabled = localStorage.getItem(LOCAL_AUTO_ENABLED_KEY) === "true";
    const localHours = Number(localStorage.getItem(LOCAL_AUTO_INTERVAL_KEY) || localInterval.value);
    localAutoToggle.checked = localEnabled;
    localInterval.value = String(localHours);
    if (localEnabled) scheduleLocalAutoBackup(localHours);
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
});
