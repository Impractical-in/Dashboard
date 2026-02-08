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

function loadFromStorage(key, fallback) {
  if (typeof loadData === "function") return loadData(key, fallback);
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    return fallback;
  }
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

function renderCalendarPreview(target) {
  const tasks = loadFromStorage("todoTasks", []);
  const projects = loadFromStorage("dashboardEntries", []);
  const hobbiesData = loadFromStorage("hobbyTracker", { hobbies: [] });
  const hobbies = Array.isArray(hobbiesData && hobbiesData.hobbies) ? hobbiesData.hobbies : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonDays = 7;
  const upcoming = [];

  if (Array.isArray(tasks)) {
    tasks.forEach((task) => {
      if (!task || !task.due) return;
      const dueDate = parseDate(task.due);
      if (!dueDate || dueDate < today) return;
      upcoming.push({
        title: task.title || "Task",
        type: "Task",
        date: dueDate,
        timed: true,
      });
    });
  }

  const addWeekly = (item, label, scheduleDays, startDate, endDate) => {
    if (!Array.isArray(scheduleDays)) return;
    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() + offset);
      if (!isWithinDateRange(day, startDate, endDate)) continue;
      if (!scheduleDays.includes(dayIndex(day))) continue;
      const date = new Date(day);
      date.setHours(9, 0, 0, 0);
      upcoming.push({
        title: item,
        type: label,
        date,
        timed: false,
      });
    }
  };

  if (Array.isArray(projects)) {
    projects.forEach((entry) => {
      addWeekly(
        entry.title || "Project",
        entry.type || "Project",
        entry.scheduleDays,
        entry.startDate,
        entry.endDate
      );
    });
  }

  hobbies.forEach((hobby) => {
    addWeekly(hobby.name || "Hobby", "Hobby", hobby.scheduleDays, null, null);
  });

  const sorted = upcoming.sort((a, b) => a.date - b.date);
  const items = sorted.slice(0, PREVIEW_LIMIT).map((item) =>
    createPreviewItem({
      title: item.title,
      pill: item.type,
      pillClass: String(item.type).toLowerCase(),
      meta: formatShortDate(item.date, item.timed),
    })
  );
  renderPreviewList(target, items, "No upcoming items scheduled.");
}

function renderSyncPreview(target) {
  const lastBackup = localStorage.getItem("localLastSnapshot");
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
    const type = target.dataset.preview;
    if (type === "todo") return renderTodoPreview(target);
    if (type === "projects") return renderProjectsPreview(target);
    if (type === "hobbies") return renderHobbiesPreview(target);
    if (type === "journal") return renderJournalPreview(target);
    if (type === "calendar") return renderCalendarPreview(target);
    if (type === "links") return renderLinksPreview(target);
    if (type === "pomodoro") return renderPomodoroPreview(target);
    if (type === "sync") return renderSyncPreview(target);
  });
}

function initPreviews() {
  if (typeof initStorage === "function") {
    initStorage().then(renderAllPreviews);
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

