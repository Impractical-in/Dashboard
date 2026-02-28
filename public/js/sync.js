(function initSimpleBackupPage() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const BACKUP_HISTORY_KEY = "localBackupHistory";
  const BACKUP_VAULT_KEY = "localBackupVault";
  const LAST_BACKUP_KEY = "localLastSnapshot";
  const saveBtn = document.getElementById("saveSnapshotBtn");
  const uploadBtn = document.getElementById("uploadSnapshotBtn");
  const uploadInput = document.getElementById("snapshotUploadInput");
  const statusEl = document.getElementById("backupStatus");
  const historyEl = document.getElementById("backupHistory");

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.borderColor = isError ? "#8a2d2a" : "";
    statusEl.style.color = isError ? "#ffb4af" : "";
  }

  function stampNow() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
  }

  function snapshotFileName() {
    return `local_state_${stampNow()}.json`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function buildLocalSnapshot() {
    const data = {};
    Object.keys(localStorage)
      .filter((key) => !key.startsWith("__"))
      .forEach((key) => {
        try {
          data[key] = JSON.parse(localStorage.getItem(key));
        } catch (_) {
          data[key] = localStorage.getItem(key);
        }
      });
    return {
      version: 1,
      source: "local",
      updatedAt: new Date().toISOString(),
      data,
    };
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function addBackupHistory(entry) {
    const existing = readJson(BACKUP_HISTORY_KEY, []);
    const next = Array.isArray(existing) ? existing : [];
    next.unshift(entry);
    writeJson(BACKUP_HISTORY_KEY, next.slice(0, 20));
  }

  function renderBackupHistory() {
    if (!historyEl) return;
    const history = readJson(BACKUP_HISTORY_KEY, []);
    if (!Array.isArray(history) || !history.length) {
      historyEl.textContent = "No local backup saved yet.";
      return;
    }
    const last = history[0];
    const lastWhen = last && last.at ? new Date(last.at).toLocaleString() : "unknown";
    const vault = readJson(BACKUP_VAULT_KEY, []);
    const vaultCount = Array.isArray(vault) ? vault.length : 0;
    historyEl.textContent = `Latest backup: ${last && last.name ? last.name : "unknown"} (${lastWhen}) | Local vault copies: ${vaultCount}`;
  }

  function persistVaultSnapshot(name, payload) {
    const vault = readJson(BACKUP_VAULT_KEY, []);
    const next = Array.isArray(vault) ? vault : [];
    next.unshift({
      name,
      at: new Date().toISOString(),
      snapshot: payload,
    });
    writeJson(BACKUP_VAULT_KEY, next.slice(0, 3));
  }

  function applySnapshotToLocalStorage(snapshot) {
    const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
    const data =
      payload.data && typeof payload.data === "object"
        ? payload.data
        : payload && typeof payload === "object"
          ? payload
          : {};
    Object.keys(localStorage)
      .filter((key) => !key.startsWith("__"))
      .forEach((key) => localStorage.removeItem(key));
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });
  }

  async function onSaveSnapshot() {
    try {
      const filename = snapshotFileName();
      const payload = buildLocalSnapshot();
      downloadJson(filename, payload);
      persistVaultSnapshot(filename, payload);
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      addBackupHistory({ name: filename, at: new Date().toISOString() });
      renderBackupHistory();
      setStatus(`Saved local snapshot: ${filename}`, false);
    } catch (err) {
      setStatus(`Save failed: ${err && err.message ? err.message : "unknown error"}`, true);
    }
  }

  async function onUploadSnapshot() {
    try {
      const file =
        uploadInput && uploadInput.files && uploadInput.files[0] ? uploadInput.files[0] : null;
      if (!file) {
        setStatus("Select a snapshot JSON file first.", true);
        return;
      }
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      applySnapshotToLocalStorage(parsed);
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      addBackupHistory({
        name: file.name || "uploaded_snapshot.json",
        at: new Date().toISOString(),
      });
      if (uploadInput) uploadInput.value = "";
      renderBackupHistory();
      setStatus(`Restored local snapshot: ${file.name || "snapshot"}. Reloading...`, false);
      window.setTimeout(() => window.location.reload(), 300);
    } catch (err) {
      setStatus(`Restore failed: ${err && err.message ? err.message : "invalid snapshot"}`, true);
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", onSaveSnapshot);
  if (uploadBtn) uploadBtn.addEventListener("click", onUploadSnapshot);
  renderBackupHistory();
})();
