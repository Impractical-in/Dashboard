const localDateTimeEl = document.getElementById("localDateTime");
const timeToggle = document.getElementById("timeToggle");
const timePanel = document.getElementById("timePanel");

const timeZones = [
  { label: "Local", zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "UTC", zone: "UTC" },
  { label: "New York", zone: "America/New_York" },
  { label: "London", zone: "Europe/London" },
  { label: "Dubai", zone: "Asia/Dubai" },
  { label: "Mumbai", zone: "Asia/Kolkata" },
  { label: "Singapore", zone: "Asia/Singapore" },
  { label: "Tokyo", zone: "Asia/Tokyo" },
  { label: "Sydney", zone: "Australia/Sydney" },
];

function formatDateTime(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function formatTimeOnly(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tz = parts.find((part) => part.type === "timeZoneName");
  return tz ? tz.value.replace("GMT", "GMT") : timeZone;
}

function updateLocalTime() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
  }).format(now);
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
  }).format(now);
  localDateTimeEl.textContent = `${time}, ${date}`;
}

function renderWorldTime() {
  timePanel.innerHTML = "";
  const now = new Date();
  const withTimes = timeZones.map((item) => ({
    ...item,
    timeValue: formatTimeOnly(now, item.zone),
    dateValue: formatDateTime(now, item.zone),
    offset: formatZoneOffset(now, item.zone),
  }));

  withTimes.sort((a, b) => a.timeValue.localeCompare(b.timeValue));

  withTimes.forEach((item) => {
    const row = document.createElement("div");
    row.className = "time-row";
    row.innerHTML = `
      <div class="time-zone">${item.label}: ${item.offset}</div>
      <div class="time-value">${item.dateValue}</div>
    `;
    timePanel.appendChild(row);
  });
}

function togglePanel() {
  const hidden = timePanel.classList.toggle("hidden");
  timeToggle.setAttribute("aria-expanded", String(!hidden));
  if (!hidden) renderWorldTime();
}

if (timeToggle) {
  timeToggle.addEventListener("click", togglePanel);
}

updateLocalTime();
setInterval(updateLocalTime, 1000 * 30);

const PREVIEW_LIMIT = 3;
const previewTargets = Array.from(document.querySelectorAll("[data-preview]"));
const dashboardMemoryStore = {};
let browserStorageAvailableCache = null;

function isBrowserStorageAvailable() {
  if (browserStorageAvailableCache !== null) return browserStorageAvailableCache;
  try {
    const probeKey = "__dashboard_probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    browserStorageAvailableCache = true;
  } catch (err) {
    browserStorageAvailableCache = false;
  }
  return browserStorageAvailableCache;
}

function saveToStorage(key, value) {
  if (isBrowserStorageAvailable()) {
    try {
      if (typeof saveData === "function") {
        saveData(key, value);
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
      return;
    } catch (err) {
      // Fallback to in-memory store when browser storage is blocked.
    }
  }
  dashboardMemoryStore[key] = value;
}

function loadFromStorage(key, fallback) {
  if (isBrowserStorageAvailable()) {
    try {
      if (typeof loadData === "function") return loadData(key, fallback);
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (err) {
      // Fallback to in-memory store.
    }
  }
  return Object.prototype.hasOwnProperty.call(dashboardMemoryStore, key)
    ? dashboardMemoryStore[key]
    : fallback;
}

function formatShortDate(value, includeTime) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const options = includeTime
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { month: "short", day: "numeric" };
  return date.toLocaleString("en-US", options);
}

function createPreviewItem({ title, pill, pillClass, meta }) {
  const item = document.createElement("li");
  item.className = "preview-item";

  const titleEl = document.createElement("span");
  titleEl.className = "preview-title";
  titleEl.textContent = title;
  item.appendChild(titleEl);

  if (pill) {
    const pillEl = document.createElement("span");
    pillEl.className = `preview-pill ${pillClass || ""}`.trim();
    pillEl.textContent = pill;
    item.appendChild(pillEl);
  }

  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "preview-meta";
    metaEl.textContent = meta;
    item.appendChild(metaEl);
  }

  return item;
}

function renderPreviewList(target, items, emptyMessage) {
  target.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "preview-empty";
    empty.textContent = emptyMessage;
    target.appendChild(empty);
    return;
  }
  const list = document.createElement("ul");
  list.className = "preview-list";
  items.forEach((item) => list.appendChild(item));
  target.appendChild(list);
}

function comparePriority(a, b) {
  const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
  return (order[a] || 9) - (order[b] || 9);
}

function renderTodoPreview(target) {
  const tasks = loadFromStorage("todoTasks", []);
  if (!Array.isArray(tasks)) {
    renderPreviewList(target, [], "No tasks yet.");
    return;
  }
  const candidates = tasks.filter((task) => task && !task.done);
  const sorted = candidates.sort((a, b) => {
    const dueA = a.due || "";
    const dueB = b.due || "";
    if (dueA === dueB) {
      const priorityCompare = comparePriority(a.priority, b.priority);
      if (priorityCompare !== 0) return priorityCompare;
      return String(a.title || "").localeCompare(String(b.title || ""));
    }
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA.localeCompare(dueB);
  });
  const items = sorted.slice(0, PREVIEW_LIMIT).map((task) => {
    const dueDate = task.due ? new Date(task.due) : null;
    const dueLabel = task.due ? `Due ${formatShortDate(task.due, true)}` : "No due date";
    let urgent = false;
    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      const now = new Date();
      const diff = dueDate.getTime() - now.getTime();
      urgent = diff <= 0 || diff <= 24 * 60 * 60 * 1000;
    }
    return createPreviewItem({
      title: `${task.title || "Untitled task"}${urgent ? " !!" : ""}`,
      pill: task.priority || "Task",
      pillClass: (task.priority || "task").toLowerCase(),
      meta: dueLabel,
    });
  });
  renderPreviewList(target, items, "Add your top priorities.");
}

function renderProjectsPreview(target) {
  const entries = loadFromStorage("dashboardEntries", []);
  if (!Array.isArray(entries)) {
    renderPreviewList(target, [], "No projects yet.");
    return;
  }
  const sorted = [...entries].sort((a, b) => {
    const dateA = a.startDate || a.endDate || a.createdAt || "";
    const dateB = b.startDate || b.endDate || b.createdAt || "";
    if (dateA === dateB) return String(a.title || "").localeCompare(String(b.title || ""));
    return dateB.localeCompare(dateA);
  });
  const items = sorted.slice(0, PREVIEW_LIMIT).map((entry) => {
    const label = entry.type || "Project";
    const dateLabel = entry.startDate || entry.endDate || entry.createdAt;
    return createPreviewItem({
      title: entry.title || "Untitled entry",
      pill: label,
      pillClass: String(label).toLowerCase(),
      meta: dateLabel ? formatShortDate(dateLabel) : "",
    });
  });
  renderPreviewList(target, items, "Add a project or learning entry.");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function streakFor(hobby) {
  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  while (true) {
    const key = current.toISOString().slice(0, 10);
    if (hobby.history && hobby.history[key]) {
      streak += 1;
      current.setDate(current.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function renderHobbiesPreview(target) {
  const data = loadFromStorage("hobbyTracker", { hobbies: [] });
  const hobbies = Array.isArray(data && data.hobbies) ? data.hobbies : [];
  const sorted = [...hobbies].sort((a, b) => streakFor(b) - streakFor(a));
  const items = sorted.slice(0, PREVIEW_LIMIT).map((hobby) =>
    createPreviewItem({
      title: hobby.name || "Hobby",
      pill: hobby.type || "Hobby",
      pillClass: "hobby",
      meta: `Streak ${streakFor(hobby)}d`,
    })
  );
  renderPreviewList(target, items, "Add a hobby to track.");
}

function normalizeJournal(data) {
  if (Array.isArray(data)) {
    const migrated = {};
    data.forEach((entry) => {
      const key = entry.createdAt ? entry.createdAt.slice(0, 10) : todayKey();
      migrated[key] = entry;
    });
    return migrated;
  }
  if (data && data.byDate && typeof data.byDate === "object") return data.byDate;
  if (data && typeof data === "object") return data;
  return {};
}

function renderJournalPreview(target) {
  const data = loadFromStorage("journalEntries", { byDate: {} });
  const byDate = normalizeJournal(data);
  const entries = Object.values(byDate || {});
  const sorted = entries.sort((a, b) => {
    const dateA = a.updatedAt || a.createdAt || "";
    const dateB = b.updatedAt || b.createdAt || "";
    if (dateA === dateB) return String(a.title || "").localeCompare(String(b.title || ""));
    return dateB.localeCompare(dateA);
  });
  const items = sorted.slice(0, PREVIEW_LIMIT).map((entry) =>
    createPreviewItem({
      title: entry.title || "Untitled",
      pill: entry.tags && entry.tags.length ? entry.tags[0] : "Journal",
      pillClass: "learning",
      meta: entry.createdAt ? formatShortDate(entry.createdAt) : "",
    })
  );
  renderPreviewList(target, items, "Capture a new journal entry.");
}

function renderLinksPreview(target) {
  const links = loadFromStorage("quickLinks", []);
  if (!Array.isArray(links)) {
    renderPreviewList(target, [], "Add quick links.");
    return;
  }
  const items = links.slice(0, PREVIEW_LIMIT).map((link) => {
    let host = "";
    try {
      host = new URL(link.url).hostname.replace("www.", "");
    } catch (err) {
      host = "";
    }
    return createPreviewItem({
      title: link.label || "Link",
      pill: "Link",
      pillClass: "link",
      meta: host,
    });
  });
  renderPreviewList(target, items, "Add a quick link.");
}

function renderPomodoroPreview(target) {
  const logs = loadFromStorage("localPomodoroLogs", []);
  if (!Array.isArray(logs)) {
    renderPreviewList(target, [], "No sessions yet.");
    return;
  }
  const items = logs.slice(0, PREVIEW_LIMIT).map((entry) =>
    createPreviewItem({
      title: entry.projectTitle || entry.type || "Session",
      pill: entry.type || "Work",
      pillClass: "task",
      meta: entry.endTime ? formatShortDate(entry.endTime, true) : "",
    })
  );
  renderPreviewList(target, items, "Log a focus session.");
}

function parseDateOnly(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function isWithinDateRange(date, startValue, endValue) {
  const start = parseDateOnly(startValue) || new Date("1970-01-01");
  const end = parseDateOnly(endValue) || new Date("2999-12-31");
  return date >= start && date <= end;
}

const DASHBOARD_CALENDAR_LAYOUT_KEY = "dashboardCalendarLayout";
const DASHBOARD_CALENDAR_DEMO_SEED_KEY = "dashboardCalendarDemoSeeded";
const DASHBOARD_CALENDAR_CARD_W = 220;
const DASHBOARD_CALENDAR_CARD_H = 118;

function readTaskDueParts(dueValue) {
  if (!dueValue || typeof dueValue !== "string") return { date: "", time: "" };
  const dateOnlyMatch = dueValue.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnlyMatch) return { date: dateOnlyMatch[1], time: "" };
  const dateTimeMatch = dueValue.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (dateTimeMatch) return { date: dateTimeMatch[1], time: dateTimeMatch[2] };
  const parsed = parseDate(dueValue);
  if (!parsed) return { date: "", time: "" };
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function loadCalendarLayout() {
  const raw = loadFromStorage(DASHBOARD_CALENDAR_LAYOUT_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

function saveCalendarLayout(layout) {
  saveToStorage(DASHBOARD_CALENDAR_LAYOUT_KEY, layout || {});
}

function updateTaskDueFromInputs(task, dateValue, timeValue) {
  if (!task) return;
  const date = String(dateValue || "").trim();
  const time = String(timeValue || "").trim();
  if (!date) {
    delete task.due;
    return;
  }
  task.due = time ? `${date}T${time}` : date;
}

function makeDefaultCardPosition(index) {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: col * (DASHBOARD_CALENDAR_CARD_W + 12), y: row * (DASHBOARD_CALENDAR_CARD_H + 12) };
}

function clampCardPosition(pos, canvas) {
  const width = Math.max(280, canvas.clientWidth || 280);
  const height = Math.max(320, canvas.clientHeight || 320);
  const maxX = Math.max(0, width - DASHBOARD_CALENDAR_CARD_W);
  const maxY = Math.max(0, height - DASHBOARD_CALENDAR_CARD_H);
  const x = Math.min(Math.max(0, Math.round(Number(pos?.x) || 0)), maxX);
  const y = Math.min(Math.max(0, Math.round(Number(pos?.y) || 0)), maxY);
  return { x, y };
}

function blockCalendarTileNavigation(target) {
  const tile = target.closest(".link-tile.calendar");
  if (!tile || tile.dataset.calendarDragReady === "1") return;
  tile.dataset.calendarDragReady = "1";
  tile.addEventListener("click", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.closest(".calendar-dash")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function seedDashboardCalendarDemoDataIfNeeded() {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return;
  const alreadySeeded = loadFromStorage(DASHBOARD_CALENDAR_DEMO_SEED_KEY, false);
  const existingTasks = loadFromStorage("todoTasks", []);
  const tasks = Array.isArray(existingTasks) ? [...existingTasks] : [];
  const layout = loadCalendarLayout();
  let changed = false;

  const requiredSampleId = "demo-wifi-dcm-omi-4x4-fr";
  const hasRequiredSample = tasks.some((task) => String(task && task.id) === requiredSampleId);

  if (!hasRequiredSample) {
    tasks.unshift({
      id: requiredSampleId,
      title: "Wifi - DCM, OMI in detail with 4x4 FR",
      priority: "P1",
      due: "2026-02-16T10:30",
      notes: "Sample task for dashboard drag/drop validation",
      tags: ["wifi", "sample"],
      linkedItems: [],
      done: false,
      createdAt: new Date().toISOString(),
    });
    layout[requiredSampleId] = layout[requiredSampleId] || { x: 0, y: 0 };
    changed = true;
  }

  if (alreadySeeded) {
    if (changed) {
      saveToStorage("todoTasks", tasks);
      saveToStorage(DASHBOARD_CALENDAR_LAYOUT_KEY, layout);
    }
    return;
  }

  const demoTasks = [
    {
      id: "demo-task-1",
      title: "Wifi - DCM, OMI in detail with 4x4 FR",
      priority: "P1",
      due: "2026-02-16T09:30",
      notes: "",
      tags: ["demo"],
      linkedItems: [],
      done: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-task-2",
      title: "Calendar drag QA",
      priority: "P2",
      due: "2026-02-16T14:00",
      notes: "",
      tags: ["demo"],
      linkedItems: [],
      done: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-task-3",
      title: "Prepare release note",
      priority: "P3",
      due: "2026-02-17",
      notes: "",
      tags: ["demo"],
      linkedItems: [],
      done: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: "demo-task-4",
      title: "Backlog grooming",
      priority: "P4",
      notes: "",
      tags: ["demo"],
      linkedItems: [],
      done: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const demoLayout = {
    "demo-task-1": { x: 0, y: 0 },
    "demo-task-2": { x: 232, y: 0 },
    "demo-task-3": { x: 0, y: 132 },
    "demo-task-4": { x: 232, y: 132 },
  };

  if (!tasks.length) {
    saveToStorage("todoTasks", demoTasks);
    saveToStorage(DASHBOARD_CALENDAR_LAYOUT_KEY, demoLayout);
  } else {
    saveToStorage("todoTasks", tasks);
    saveToStorage(DASHBOARD_CALENDAR_LAYOUT_KEY, layout);
  }
  saveToStorage(DASHBOARD_CALENDAR_DEMO_SEED_KEY, true);
}

function renderCalendarPreview(target) {
  seedDashboardCalendarDemoDataIfNeeded();
  blockCalendarTileNavigation(target);
  const tasks = loadFromStorage("todoTasks", []);
  const activeTasks = Array.isArray(tasks) ? tasks.filter((task) => task && !task.done) : [];

  target.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "calendar-dash";
  wrap.innerHTML = `
    <div class="calendar-dash-meta">Drag tasks anywhere in this board, then set date/time inline.</div>
    <div class="calendar-dash-board"></div>
  `;
  target.appendChild(wrap);

  const board = wrap.querySelector(".calendar-dash-board");
  if (!board || !activeTasks.length) {
    const empty = document.createElement("div");
    empty.className = "preview-empty";
    empty.textContent = "No active tasks. Add tasks in To-Do to schedule here.";
    target.appendChild(empty);
    return;
  }

  const taskMap = new Map(activeTasks.map((task) => [String(task.id), task]));
  const layout = loadCalendarLayout();
  let currentZ = 1;

  const persistTaskUpdates = () => {
    const next = Array.isArray(tasks) ? tasks : [];
    saveToStorage("todoTasks", next);
    renderAllPreviews();
  };

  activeTasks.slice(0, 12).forEach((task, index) => {
    const id = String(task.id || "");
    if (!id) return;
    const dueParts = readTaskDueParts(task.due);
    const pos = clampCardPosition(layout[id] || makeDefaultCardPosition(index), board);
    layout[id] = pos;

    const card = document.createElement("article");
    card.className = "calendar-task-card";
    card.dataset.taskId = id;
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
    card.style.zIndex = String(currentZ++);
    card.innerHTML = `
      <div class="calendar-task-head">
        <span class="calendar-task-title">${task.title || "Untitled task"}</span>
      </div>
      <div class="calendar-task-row">
        <label>Date</label>
        <input type="date" value="${dueParts.date}" />
      </div>
      <div class="calendar-task-row">
        <label>Time</label>
        <input type="time" value="${dueParts.time}" />
        <button type="button" class="calendar-clear-time">Clear</button>
      </div>
    `;
    board.appendChild(card);

    const dateInput = card.querySelector("input[type='date']");
    const timeInput = card.querySelector("input[type='time']");
    const clearBtn = card.querySelector(".calendar-clear-time");

    const applyDueFromInputs = () => {
      const liveTask = taskMap.get(id);
      if (!liveTask || !dateInput || !timeInput) return;
      updateTaskDueFromInputs(liveTask, dateInput.value, timeInput.value);
      persistTaskUpdates();
    };

    if (dateInput) dateInput.addEventListener("change", applyDueFromInputs);
    if (timeInput) timeInput.addEventListener("change", applyDueFromInputs);
    if (clearBtn) {
      clearBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (timeInput) timeInput.value = "";
        applyDueFromInputs();
      });
    }

    const startCardDrag = (startClientX, startClientY) => {
      const startLeft = Number.parseFloat(card.style.left || "0");
      const startTop = Number.parseFloat(card.style.top || "0");
      card.style.zIndex = String(currentZ++);

      const onMove = (clientX, clientY) => {
        const nextPos = clampCardPosition(
          {
            x: startLeft + (clientX - startClientX),
            y: startTop + (clientY - startClientY),
          },
          board
        );
        card.style.left = `${nextPos.x}px`;
        card.style.top = `${nextPos.y}px`;
      };

      const onEnd = () => {
        const endPos = clampCardPosition(
          {
            x: Number.parseFloat(card.style.left || "0"),
            y: Number.parseFloat(card.style.top || "0"),
          },
          board
        );
        layout[id] = endPos;
        saveCalendarLayout(layout);
      };

      return { onMove, onEnd };
    };

    card.addEventListener("pointerdown", (event) => {
      const targetEl = event.target;
      if (targetEl instanceof HTMLElement && targetEl.closest("input,button,label")) return;
      event.preventDefault();
      const drag = startCardDrag(event.clientX, event.clientY);
      const pointerId = event.pointerId;
      if (typeof card.setPointerCapture === "function") {
        try {
          card.setPointerCapture(pointerId);
        } catch (_) {}
      }

      const onPointerMove = (moveEvent) => drag.onMove(moveEvent.clientX, moveEvent.clientY);
      const onPointerEnd = () => {
        card.removeEventListener("pointermove", onPointerMove);
        card.removeEventListener("pointerup", onPointerEnd);
        card.removeEventListener("pointercancel", onPointerEnd);
        drag.onEnd();
      };

      card.addEventListener("pointermove", onPointerMove);
      card.addEventListener("pointerup", onPointerEnd);
      card.addEventListener("pointercancel", onPointerEnd);
    });

    card.addEventListener("mousedown", (event) => {
      const targetEl = event.target;
      if (targetEl instanceof HTMLElement && targetEl.closest("input,button,label")) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const drag = startCardDrag(event.clientX, event.clientY);

      const onMouseMove = (moveEvent) => drag.onMove(moveEvent.clientX, moveEvent.clientY);
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        drag.onEnd();
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    card.addEventListener(
      "touchstart",
      (event) => {
        const targetEl = event.target;
        if (targetEl instanceof HTMLElement && targetEl.closest("input,button,label")) return;
        const touch = event.touches && event.touches[0];
        if (!touch) return;
        event.preventDefault();
        const drag = startCardDrag(touch.clientX, touch.clientY);

        const onTouchMove = (moveEvent) => {
          const nextTouch = moveEvent.touches && moveEvent.touches[0];
          if (!nextTouch) return;
          drag.onMove(nextTouch.clientX, nextTouch.clientY);
          moveEvent.preventDefault();
        };
        const onTouchEnd = () => {
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
          window.removeEventListener("touchcancel", onTouchEnd);
          drag.onEnd();
        };

        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd);
        window.addEventListener("touchcancel", onTouchEnd);
      },
      { passive: false }
    );
  });

  saveCalendarLayout(layout);
}

function renderSyncPreview(target) {
  const lastBackup = loadFromStorage("localLastSnapshot", null);
  const items = [
    createPreviewItem({
      title: "Local backup",
      pill: "Sync",
      pillClass: "link",
      meta: lastBackup ? formatShortDate(lastBackup, true) : "No snapshot yet",
    }),
  ];
  renderPreviewList(target, items, "Open Settings & Backup to manage restore and snapshots.");
}

function renderAllPreviews() {
  previewTargets.forEach((target) => {
    try {
      const type = target.dataset.preview;
      if (type === "todo") return renderTodoPreview(target);
      if (type === "projects") return renderProjectsPreview(target);
      if (type === "hobbies") return renderHobbiesPreview(target);
      if (type === "journal") return renderJournalPreview(target);
      if (type === "calendar") return renderCalendarPreview(target);
      if (type === "links") return renderLinksPreview(target);
      if (type === "pomodoro") return renderPomodoroPreview(target);
      if (type === "sync") return renderSyncPreview(target);
    } catch (err) {
      target.innerHTML = "";
      const fallback = document.createElement("div");
      fallback.className = "preview-empty";
      fallback.textContent = "Preview unavailable in this browser mode.";
      target.appendChild(fallback);
    }
  });
}

function initPreviews() {
  seedDashboardCalendarDemoDataIfNeeded();
  if (typeof window !== "undefined") {
    const protocol = String((window.location && window.location.protocol) || "").toLowerCase();
    if (protocol === "file:") {
      renderAllPreviews();
      return;
    }
  }
  if (typeof initStorage === "function") {
    initStorage()
      .then(renderAllPreviews)
      .catch(() => {
        renderAllPreviews();
      });
  } else {
    renderAllPreviews();
  }
}

if (previewTargets.length) {
  initPreviews();
  window.addEventListener("focus", renderAllPreviews);
  window.addEventListener("storage", renderAllPreviews);
}

const footerVersion = document.getElementById("appVersion");
if (footerVersion && typeof window !== "undefined" && window.APP_VERSION) {
  footerVersion.textContent = `v${window.APP_VERSION}`;
}

