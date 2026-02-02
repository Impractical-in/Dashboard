const hourglass = document.getElementById("hourglass");
const ctx = hourglass.getContext("2d");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");

const timeLeftEl = document.getElementById("timeLeft");
const progressText = document.getElementById("progressText");
const sessionTypeEl = document.getElementById("sessionType");
const notesEl = document.getElementById("sessionNotes");

const workMinutesInput = document.getElementById("workMinutes");
const breakMinutesInput = document.getElementById("breakMinutes");
const audioFileInput = document.getElementById("audioFile");
const audioEnabledInput = document.getElementById("audioEnabled");
const projectSelect = document.getElementById("projectSelect");
const refreshProjectsBtn = document.getElementById("refreshProjects");

const logList = document.getElementById("logList");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

const STORAGE_KEY = "localPomodoroLogs";
const PROJECTS_KEY = "dashboardEntries";
const THEME_KEY = "localPomodoroTheme";

let timerId = null;
let state = {
  mode: "Work",
  running: false,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  sessionStart: null,
  sessionProjectId: "",
  sessionProjectTitle: "",
  pendingSegment: null,
};

let logs = [];
let projects = [];
const audioPlayer = new Audio();
audioPlayer.loop = true;
audioPlayer.volume = 0.6;

function loadLogs() {
  const data = loadData(STORAGE_KEY, []);
  return Array.isArray(data) ? data : [];
}

function saveLogs() {
  saveData(STORAGE_KEY, logs);
}

function loadProjects() {
  const data = loadData(PROJECTS_KEY, []);
  return Array.isArray(data) ? data : [];
}

function refreshProjectsList() {
  projects = loadProjects();
  populateProjects();
}

function populateProjects() {
  if (!projectSelect) return;
  const current = projectSelect.value;
  projectSelect.innerHTML = "<option value=\"\">No project selected</option>";
  projects.forEach((entry) => {
    if (!entry || !entry.id || !entry.title) return;
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.title} (${entry.type || "Project"})`;
    projectSelect.appendChild(option);
  });
  if (current) projectSelect.value = current;
}

function getSelectedProject() {
  return projects.find((entry) => entry.id === projectSelect.value) || null;
}

function addProjectWorkSegment(projectId, startTime, endTime, source) {
  if (!projectId || !startTime || !endTime) return;
  const data = loadData(PROJECTS_KEY, []);
  if (!Array.isArray(data)) return;
  const entry = data.find((item) => item.id === projectId);
  if (!entry) return;
  if (!Array.isArray(entry.workSegments)) entry.workSegments = [];
  entry.workSegments.push({ start: startTime, end: endTime, source });
  saveData(PROJECTS_KEY, data);
}

function finalizePendingSegment(endTime) {
  if (!state.pendingSegment) return;
  addProjectWorkSegment(
    state.pendingSegment.projectId,
    state.pendingSegment.startTime,
    endTime,
    state.pendingSegment.source
  );
  state.pendingSegment = null;
}

function setTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  themeToggle.setAttribute("aria-pressed", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateDisplay() {
  timeLeftEl.textContent = formatTime(state.remainingSeconds);
  const progress = state.totalSeconds
    ? 1 - state.remainingSeconds / state.totalSeconds
    : 0;
  progressText.textContent = `${Math.round(progress * 100)}%`;
  sessionTypeEl.textContent = state.mode;
  drawHourglass(progress);
}

function updateButtons() {
  startBtn.disabled = state.running;
  pauseBtn.disabled = !state.running;
}

function getSettings() {
  return {
    workMinutes: Math.max(1, Number(workMinutesInput.value) || 25),
    breakMinutes: Math.max(1, Number(breakMinutesInput.value) || 5),
  };
}

function setSession(mode, minutes) {
  state.mode = mode;
  state.totalSeconds = minutes * 60;
  state.remainingSeconds = state.totalSeconds;
  state.sessionStart = null;
  if (mode !== "Work") stopAudio();
  updateDisplay();
}

function startTimer() {
  if (state.running) return;
  if (!state.sessionStart) {
    state.sessionStart = new Date().toISOString();
    if (state.mode === "Work") {
      const selected = getSelectedProject();
      state.sessionProjectId = selected ? selected.id : "";
      state.sessionProjectTitle = selected ? selected.title : "";
    }
  }
  state.running = true;
  updateButtons();
  startAudioIfNeeded();
  timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      stopTimer();
      completeSession();
    }
    updateDisplay();
  }, 1000);
}

function stopTimer() {
  state.running = false;
  updateButtons();
  stopAudio();
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function resetTimer() {
  if (state.mode === "Short Break") {
    finalizePendingSegment(new Date().toISOString());
  }
  stopTimer();
  const settings = getSettings();
  if (state.mode === "Work") setSession("Work", settings.workMinutes);
  if (state.mode === "Short Break") setSession("Short Break", settings.breakMinutes);
}

function completeSession() {
  const settings = getSettings();
  const endTime = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    type: state.mode,
    plannedMinutes: Math.round(state.totalSeconds / 60),
    actualSeconds: state.totalSeconds,
    startTime: state.sessionStart || endTime,
    endTime,
    notes: notesEl.value.trim(),
    projectId: state.sessionProjectId,
    projectTitle: state.sessionProjectTitle,
  };
  logs.unshift(entry);
  saveLogs();
  renderLogs();
  notesEl.value = "";

  if (state.mode === "Work") {
    if (state.sessionProjectId) {
      state.pendingSegment = {
        projectId: state.sessionProjectId,
        startTime: state.sessionStart || endTime,
        source: "pomodoro",
      };
    }
    setSession("Short Break", settings.breakMinutes);
    startTimer();
  } else {
    finalizePendingSegment(endTime);
    setSession("Work", settings.workMinutes);
  }
}

function renderLogs() {
  const search = searchInput.value.toLowerCase();
  const type = typeFilter.value;
  const filtered = logs.filter((entry) => {
    const matchesType = type === "all" || entry.type === type;
    const matchesSearch = entry.notes.toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });

  logList.innerHTML = "";
  if (filtered.length === 0) {
    logList.innerHTML = `<div class="log-item">No sessions logged yet.</div>`;
    return;
  }

  filtered.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "log-item";
    const start = new Date(entry.startTime).toLocaleString();
    const end = new Date(entry.endTime).toLocaleString();
    const projectLine = entry.projectTitle
      ? `<div class="log-meta">Project: ${entry.projectTitle}</div>`
      : "";
    item.innerHTML = `
      <div class="log-title">
        <span>${entry.type}</span>
        <span>${entry.plannedMinutes} min</span>
      </div>
      ${projectLine}
      <div class="log-meta">Start: ${start}</div>
      <div class="log-meta">End: ${end}</div>
      <div>${entry.notes ? entry.notes : "<em>No notes</em>"}</div>
    `;
    logList.appendChild(item);
  });
}

function exportLogs() {
  const blob = new Blob([JSON.stringify(logs, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pomodoro-log.json";
  link.click();
  URL.revokeObjectURL(url);
}

function clearLogs() {
  if (!confirm("Clear all logged sessions?")) return;
  logs = [];
  saveLogs();
  renderLogs();
}

function drawHourglass(progress) {
  const width = hourglass.width;
  const height = hourglass.height;
  const centerX = width / 2;
  const topY = 20;
  const neckY = 130;
  const neckBottomY = 150;
  const bottomY = 260;
  const leftBase = 40;
  const rightBase = 180;
  const baseWidth = rightBase - leftBase;

  ctx.clearRect(0, 0, width, height);

  ctx.lineWidth = 4;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--text");

  ctx.beginPath();
  ctx.moveTo(leftBase, topY);
  ctx.lineTo(rightBase, topY);
  ctx.lineTo(centerX, neckY);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, neckBottomY);
  ctx.lineTo(leftBase, bottomY);
  ctx.lineTo(rightBase, bottomY);
  ctx.closePath();
  ctx.stroke();

  const topLevel = Math.max(0, Math.min(1, 1 - progress));
  const bottomLevel = Math.max(0, Math.min(1, progress));
  const sandColor = getComputedStyle(document.body).getPropertyValue("--primary");
  let bottomSandTop = bottomY;

  if (topLevel > 0) {
    const ySand = topY + progress * (neckY - topY);
    const ratio = (ySand - topY) / (neckY - topY);
    const widthAtY = baseWidth * (1 - ratio);
    const xLeft = centerX - widthAtY / 2;
    const xRight = centerX + widthAtY / 2;
    ctx.fillStyle = sandColor;
    ctx.beginPath();
    ctx.moveTo(xLeft, ySand);
    ctx.lineTo(xRight, ySand);
    ctx.lineTo(centerX, neckY);
    ctx.closePath();
    ctx.fill();
  }

  if (bottomLevel > 0) {
    const ySand = bottomY - bottomLevel * (bottomY - neckBottomY);
    bottomSandTop = ySand;
    const ratio = (ySand - neckBottomY) / (bottomY - neckBottomY);
    const widthAtY = baseWidth * ratio;
    const xLeft = centerX - widthAtY / 2;
    const xRight = centerX + widthAtY / 2;
    ctx.fillStyle = sandColor;
    ctx.beginPath();
    ctx.moveTo(xLeft, ySand);
    ctx.lineTo(xRight, ySand);
    ctx.lineTo(rightBase, bottomY);
    ctx.lineTo(leftBase, bottomY);
    ctx.closePath();
    ctx.fill();
  }

  if (progress > 0 && progress < 1) {
    ctx.strokeStyle = sandColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, neckY + 4);
    ctx.lineTo(centerX, Math.max(neckBottomY - 4, bottomSandTop - 2));
    ctx.stroke();
  }
}

function attachEvents() {
  startBtn.addEventListener("click", startTimer);
  pauseBtn.addEventListener("click", stopTimer);
  resetBtn.addEventListener("click", resetTimer);

  [workMinutesInput, breakMinutesInput].forEach((input) => {
    input.addEventListener("change", () => {
      if (!state.running) resetTimer();
    });
  });

  audioFileInput.addEventListener("change", () => {
    updateAudioSource();
    if (state.running) startAudioIfNeeded();
  });

  audioEnabledInput.addEventListener("change", () => {
    if (audioEnabledInput.checked && state.running) {
      startAudioIfNeeded();
    } else {
      stopAudio();
    }
  });

  if (refreshProjectsBtn) {
    refreshProjectsBtn.addEventListener("click", refreshProjectsList);
  }

  searchInput.addEventListener("input", renderLogs);
  typeFilter.addEventListener("change", renderLogs);
  exportBtn.addEventListener("click", exportLogs);
  clearBtn.addEventListener("click", clearLogs);
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
    setTheme(nextTheme);
    updateDisplay();
  });
}

function init() {
  setTheme(getTheme());
  updateAudioSource();
  refreshProjectsList();
  const settings = getSettings();
  setSession("Work", settings.workMinutes);
  logs = loadLogs();
  renderLogs();
  updateButtons();
  attachEvents();
}

initStorage().then(init);

function updateAudioSource() {
  const source = audioFileInput.value.trim();
  audioPlayer.src = source;
}

function startAudioIfNeeded() {
  if (!audioEnabledInput.checked) return;
  if (state.mode !== "Work") return;
  if (!audioPlayer.src) return;
  audioPlayer.play().catch(() => {});
}

function stopAudio() {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
}
