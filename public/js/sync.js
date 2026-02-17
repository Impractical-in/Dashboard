(function initSimpleBackupPage() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const saveBtn = document.getElementById("saveSnapshotBtn");
  const uploadBtn = document.getElementById("uploadSnapshotBtn");
  const targetSelect = document.getElementById("snapshotTarget");
  const uploadInput = document.getElementById("snapshotUploadInput");
  const statusEl = document.getElementById("backupStatus");

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.borderColor = isError ? "#b92c2c" : "";
    statusEl.style.color = isError ? "#ffd7d7" : "";
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
    return `server_state_${stampNow()}.json`;
  }

  function buildLocalSnapshot() {
    const data = {};
    Object.keys(localStorage)
      .filter((key) => !key.startsWith("__"))
      .forEach((key) => {
        try {
          data[key] = JSON.parse(localStorage.getItem(key));
        } catch (err) {
          data[key] = localStorage.getItem(key);
        }
      });
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      data,
    };
  }

  async function fetchServerSnapshot() {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("Failed to read server state");
    const payload = await response.json();
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      data: payload && payload.data && typeof payload.data === "object" ? payload.data : {},
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

  async function uploadToServer(name, backupPayload) {
    const response = await fetch("/api/state/backups/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        backup: backupPayload,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Upload failed");
    }
    return response.json();
  }

  async function onSaveSnapshot() {
    try {
      const target = targetSelect ? String(targetSelect.value || "server") : "server";
      const filename = snapshotFileName();
      if (target === "device") {
        const payload = location.protocol.startsWith("http")
          ? await fetchServerSnapshot()
          : buildLocalSnapshot();
        downloadJson(filename, payload);
        setStatus(`Saved to device: ${filename}`, false);
        return;
      }

      if (!location.protocol.startsWith("http")) {
        setStatus("Server save requires opening dashboard via http://<ip>:8080", true);
        return;
      }
      const payload = await fetchServerSnapshot();
      await uploadToServer(filename, payload);
      setStatus(`Saved snapshot to server: ${filename}`, false);
    } catch (err) {
      setStatus(`Save failed: ${err && err.message ? err.message : "unknown error"}`, true);
    }
  }

  async function onUploadSnapshot() {
    try {
      if (!location.protocol.startsWith("http")) {
        setStatus("Upload requires opening dashboard via http://<ip>:8080", true);
        return;
      }
      const file = uploadInput && uploadInput.files && uploadInput.files[0] ? uploadInput.files[0] : null;
      if (!file) {
        setStatus("Select a snapshot JSON file first.", true);
        return;
      }
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const envelope =
        parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object"
          ? parsed
          : { version: 1, updatedAt: new Date().toISOString(), data: parsed };
      const filename = file.name && file.name.endsWith(".json") ? file.name : snapshotFileName();
      await uploadToServer(filename, envelope);
      if (uploadInput) uploadInput.value = "";
      setStatus(`Uploaded snapshot to server: ${filename}`, false);
    } catch (err) {
      setStatus(`Upload failed: ${err && err.message ? err.message : "invalid snapshot"}`, true);
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", onSaveSnapshot);
  if (uploadBtn) uploadBtn.addEventListener("click", onUploadSnapshot);
})();
