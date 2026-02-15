const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekView = document.getElementById("weekView");
const prevPeriod = document.getElementById("prevPeriod");
const nextPeriod = document.getElementById("nextPeriod");
const monthViewBtn = document.getElementById("monthViewBtn");
const weekViewBtn = document.getElementById("weekViewBtn");
const dayDetails = document.getElementById("dayDetails");
const helpToggleBtn = document.getElementById("helpToggleBtn");
const shortcutsPanel = document.getElementById("shortcutsPanel");
const shortcutsCloseBtn = document.getElementById("shortcutsCloseBtn");
const quickAddForm = document.getElementById("quickAddForm");
const quickEntryType = document.getElementById("quickEntryType");
const quickTaskTitle = document.getElementById("quickTaskTitle");
const quickTaskDate = document.getElementById("quickTaskDate");
const quickTaskTime = document.getElementById("quickTaskTime");
const quickTaskDuration = document.getElementById("quickTaskDuration");
const quickTaskPriority = document.getElementById("quickTaskPriority");
const quickTaskColor = document.getElementById("quickTaskColor");
const quickTaskSeriesToggle = document.getElementById("quickTaskSeriesToggle");
const quickSeriesFields = document.getElementById("quickSeriesFields");
const quickSeriesEndDate = document.getElementById("quickSeriesEndDate");
const quickSeriesDays = document.getElementById("quickSeriesDays");

const TASKS_KEY = "todoTasks";
const PROJECTS_KEY = "dashboardEntries";
const HOBBIES_KEY = "hobbyTracker";
const CALENDAR_DEMO_SEED_KEY = "calendarDemoSeededV5";

const SLOT_HEIGHT = 34;
const MIN_DURATION = 15;
const MAX_DURATION = 12 * 60;

const memoryStore = {};
let storageAvailableCache = null;
let viewDate = new Date();
let viewMode = "week";
let activeDragTaskId = null;

viewDate.setHours(0, 0, 0, 0);

function isStorageAvailable() {
  if (storageAvailableCache !== null) return storageAvailableCache;
  try {
    const probe = "__calendar_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    storageAvailableCache = true;
  } catch (err) {
    storageAvailableCache = false;
  }
  return storageAvailableCache;
}

function safeLoad(key, fallback) {
  if (isStorageAvailable()) {
    try {
      if (typeof loadData === "function") return loadData(key, fallback);
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (err) {}
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback;
}

function safeSave(key, value) {
  if (isStorageAvailable()) {
    try {
      if (typeof saveData === "function") {
        saveData(key, value);
        return;
      }
      localStorage.setItem(key, JSON.stringify(value));
      return;
    } catch (err) {}
  }
  memoryStore[key] = value;
}

function generateTaskIdLocal() {
  if (typeof generateId === "function") return generateId();
  return `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function generateSeriesId() {
  return `series_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function createQuickTask({ title, due, priority, durationMinutes, customColor = "", seriesId = "", seriesOriginId = "" }) {
  const now = new Date().toISOString();
  const task = {
    id: generateTaskIdLocal(),
    title,
    priority: priority || "P2",
    due,
    notes: "",
    tags: [],
    linkedItems: [],
    checklist: [],
    done: false,
    createdAt: now,
    updatedAt: now,
    durationMinutes: clampDuration(durationMinutes || 60),
  };
  if (customColor) task.customColor = customColor;
  if (seriesId) task.seriesId = seriesId;
  if (seriesOriginId) task.seriesOriginId = seriesOriginId;
  applyEndTime(task);
  return task;
}

function selectedSeriesDays() {
  if (!quickSeriesDays) return [];
  return Array.from(quickSeriesDays.querySelectorAll('input[type="checkbox"]:checked')).map((box) => Number(box.value));
}

function syncQuickSeriesVisibility() {
  if (!quickTaskSeriesToggle || !quickSeriesFields) return;
  quickSeriesFields.classList.toggle("hidden", !quickTaskSeriesToggle.checked);
}

function setQuickAddDefaults() {
  if (quickTaskDate && !quickTaskDate.value) quickTaskDate.value = formatDayKey(new Date());
  if (quickSeriesEndDate && quickTaskDate && !quickSeriesEndDate.value) quickSeriesEndDate.value = quickTaskDate.value;
  if (quickSeriesDays && quickTaskDate) {
    const start = parseDateOnly(quickTaskDate.value);
    if (start) {
      const idx = dayIndex(start);
      quickSeriesDays.querySelectorAll('input[type="checkbox"]').forEach((box) => {
        box.checked = Number(box.value) === idx;
      });
    }
  }
}

function quickDueForDay(dayKey) {
  const time = String(quickTaskTime?.value || "").trim();
  if (!time) return dayKey;
  return `${dayKey}T${time}`;
}

function handleQuickAddSubmit(event) {
  event.preventDefault();
  const entryType = String(quickEntryType?.value || "Task");
  const title = String(quickTaskTitle?.value || "").trim();
  const startDate = parseDateOnly(quickTaskDate?.value);
  if (!title || !startDate) return;

  const durationMinutes = Number(quickTaskDuration?.value || 60);
  const priority = quickTaskPriority?.value || "P2";
  const customColor = String(quickTaskColor?.value || "").trim();
  const endDateRaw = parseDateOnly(quickSeriesEndDate?.value);
  const endDate = endDateRaw && endDateRaw >= startDate ? endDateRaw : startDate;
  const days = selectedSeriesDays();
  const allowDays = days.length ? days : [dayIndex(startDate)];

  if (entryType === "Task") {
    const tasks = safeLoad(TASKS_KEY, []);
    if (!Array.isArray(tasks)) return;

    if (quickTaskSeriesToggle?.checked) {
      const seriesId = generateSeriesId();
      let originId = "";

      for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
        if (!allowDays.includes(dayIndex(day))) continue;
        const dayKey = formatDayKey(day);
        const task = createQuickTask({
          title,
          due: quickDueForDay(dayKey),
          priority,
          durationMinutes,
          customColor,
          seriesId,
          seriesOriginId: originId,
        });
        if (!originId) {
          originId = task.id;
          task.seriesOriginId = originId;
        }
        tasks.push(task);
      }
    } else {
      const dayKey = formatDayKey(startDate);
      tasks.push(
        createQuickTask({
          title,
          due: quickDueForDay(dayKey),
          priority,
          durationMinutes,
          customColor,
        })
      );
    }

    safeSave(TASKS_KEY, tasks);
  } else {
    const entries = safeLoad(PROJECTS_KEY, []);
    if (!Array.isArray(entries)) return;
    const now = new Date().toISOString();
    const finalEnd = quickTaskSeriesToggle?.checked ? endDate : startDate;
    const scheduleDays = quickTaskSeriesToggle?.checked ? allowDays : [dayIndex(startDate)];

    entries.push({
      id: generateTaskIdLocal(),
      type: entryType,
      title,
      startDate: formatDayKey(startDate),
      endDate: formatDayKey(finalEnd),
      links: [],
      notes: "",
      tags: [],
      linkedItems: [],
      scheduleDays: [...new Set(scheduleDays)].sort((a, b) => a - b),
      workSegments: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    });

    safeSave(PROJECTS_KEY, entries);
  }

  quickAddForm?.reset();
  if (quickTaskColor) quickTaskColor.value = "#c84632";
  if (quickEntryType) quickEntryType.value = "Task";
  setQuickAddDefaults();
  syncQuickSeriesVisibility();
  syncQuickAddMode();
  updateView();
}

function syncQuickAddMode() {
  const mode = String(quickEntryType?.value || "Task");
  const taskOnly = mode === "Task";
  document.querySelectorAll("[data-quick-task-only]").forEach((el) => {
    if (taskOnly) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

function initQuickAdd() {
  if (!quickAddForm) return;
  setQuickAddDefaults();
  syncQuickSeriesVisibility();
  syncQuickAddMode();

  if (quickEntryType) {
    quickEntryType.addEventListener("change", () => {
      syncQuickAddMode();
    });
  }

  if (quickTaskSeriesToggle) {
    quickTaskSeriesToggle.addEventListener("change", () => {
      if (quickTaskSeriesToggle.checked && quickSeriesEndDate && quickTaskDate) quickSeriesEndDate.value = quickTaskDate.value;
      syncQuickSeriesVisibility();
    });
  }

  if (quickTaskDate) {
    quickTaskDate.addEventListener("change", () => {
      if (quickSeriesEndDate) quickSeriesEndDate.value = quickTaskDate.value;
      if (quickSeriesDays) {
        const start = parseDateOnly(quickTaskDate.value);
        if (!start) return;
        const idx = dayIndex(start);
        quickSeriesDays.querySelectorAll('input[type="checkbox"]').forEach((box) => {
          box.checked = Number(box.value) === idx;
        });
      }
    });
  }

  quickAddForm.addEventListener("submit", handleQuickAddSubmit);
}function startOfWeek(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function formatDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function clampDuration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(n / 15) * 15));
}

function formatClock(hour, minute) {
  const h = Math.max(0, Math.min(23, Number(hour) || 0));
  const m = Math.max(0, Math.min(59, Number(minute) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function endClock(hour, minute, durationMinutes) {
  const start = (Math.max(0, Math.min(23, Number(hour) || 0)) * 60) + Math.max(0, Math.min(59, Number(minute) || 0));
  const end = start + clampDuration(durationMinutes || 60);
  return formatClock(Math.floor(end / 60) % 24, end % 60);
}

function buildDueAt(dayKey, hour, minute = 0) {
  const hh = String(Math.max(0, Math.min(23, Number(hour) || 0))).padStart(2, "0");
  const mm = String(Math.max(0, Math.min(59, Number(minute) || 0))).padStart(2, "0");
  return `${dayKey}T${hh}:${mm}`;
}

function taskRangeLabel(item, durationMinutes) {
  if (!item || !item.timed) return item?.title || "Task";
  const start = formatClock(item.hour, item.minute);
  const end = endClock(item.hour, item.minute, durationMinutes ?? item.durationMinutes);
  return `${start}-${end} ${item.title}`;
}

function applyEndTime(task) {
  const start = parseDate(task.due);
  if (!start) return;
  const duration = clampDuration(task.durationMinutes || 60);
  task.endsAt = new Date(start.getTime() + duration * 60000).toISOString();
}

function ensureSeriesFields(task, seriesId, originId) {
  if (!task) return;
  task.seriesId = seriesId || task.seriesId || generateSeriesId();
  task.seriesOriginId = originId || task.seriesOriginId || task.id;
}

function cloneTaskAtSlot(baseTask, dayKey, hour, keepSeries = false) {
  const copy = {
    ...baseTask,
    id: generateTaskIdLocal(),
    done: false,
    createdAt: new Date().toISOString(),
    due: buildDueAt(dayKey, hour, 0),
    durationMinutes: clampDuration(baseTask.durationMinutes || 60),
  };
  if (!keepSeries) {
    delete copy.seriesId;
    delete copy.seriesOriginId;
  }
  applyEndTime(copy);
  return copy;
}

function seedCalendarDemoDataIfNeeded() {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return;
  if (safeLoad(CALENDAR_DEMO_SEED_KEY, false)) return;

  const existing = safeLoad(TASKS_KEY, []);
  const existingList = Array.isArray(existing) ? existing : [];
  const scheduledCount = existingList.filter((task) => {
    if (!task || task.done || !task.due) return false;
    return Boolean(parseDate(task.due));
  }).length;
  if (scheduledCount > 0) {
    safeSave(CALENDAR_DEMO_SEED_KEY, true);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoDate = (offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return formatDayKey(d);
  };

  const demoTasks = [
    { id: "cal-demo-1", title: "Wifi - DCM, OMI in detail with 4x4 FR", priority: "P1", due: `${isoDate(0)}T10:30`, durationMinutes: 90 },
    { id: "cal-demo-2", title: "Read 11ax notes", priority: "P2", due: isoDate(1), durationMinutes: 60 },
    { id: "cal-demo-3", title: "PHY lab run", priority: "P2", due: `${isoDate(2)}T15:00`, durationMinutes: 120 },
    { id: "cal-demo-4", title: "Team sync", priority: "P3", due: `${isoDate(3)}T11:00`, durationMinutes: 45 },
    { id: "cal-demo-5", title: "Backlog grooming", priority: "P4", durationMinutes: 30 },
  ].map((task, i) => ({
    notes: "",
    tags: ["demo"],
    linkedItems: [],
    done: false,
    createdAt: `${isoDate(i)}T08:00:00.000Z`,
    ...task,
  }));

  safeSave(TASKS_KEY, existingList.length ? [...existingList, ...demoTasks] : demoTasks);
  safeSave(CALENDAR_DEMO_SEED_KEY, true);
}

function saveTaskDueAtSlot(taskId, dayKey, hour, copyMode = false) {
  if (!taskId || !dayKey) return;
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!task) return;

  if (copyMode) {
    tasks.push(cloneTaskAtSlot(task, dayKey, hour, false));
    safeSave(TASKS_KEY, tasks);
    return;
  }

  if (task.seriesId) {
    const sourceDate = parseDate(task.due);
    const targetDate = parseDateOnly(dayKey);
    if (sourceDate && targetDate) {
      const sourceDay = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
      const dayDelta = Math.round((targetDate.getTime() - sourceDay.getTime()) / (24 * 60 * 60 * 1000));
      tasks.forEach((item) => {
        if (item.seriesId !== task.seriesId || !item.due) return;
        const current = parseDate(item.due);
        if (!current) return;
        const shifted = new Date(current);
        shifted.setDate(shifted.getDate() + dayDelta);
        item.due = buildDueAt(formatDayKey(shifted), hour, 0);
        item.durationMinutes = clampDuration(task.durationMinutes || item.durationMinutes || 60);
        applyEndTime(item);
      });
      safeSave(TASKS_KEY, tasks);
      return;
    }
  }

  task.due = buildDueAt(dayKey, hour, 0);
  task.durationMinutes = clampDuration(task.durationMinutes || 60);
  applyEndTime(task);
  safeSave(TASKS_KEY, tasks);
}

function saveTaskDuration(taskId, durationMinutes) {
  if (!taskId) return;
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!task) return;

  if (task.seriesId) {
    tasks.forEach((item) => {
      if (item.seriesId !== task.seriesId) return;
      item.durationMinutes = clampDuration(durationMinutes);
      applyEndTime(item);
    });
    safeSave(TASKS_KEY, tasks);
    return;
  }

  task.durationMinutes = clampDuration(durationMinutes);
  applyEndTime(task);
  safeSave(TASKS_KEY, tasks);
}

function saveTaskTiming(taskId, dayKey, startMinuteOfDay, durationMinutes) {
  if (!taskId || !dayKey) return;
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!task) return;

  const minuteOfDay = Math.max(0, Math.min(23 * 60 + 59, Number(startMinuteOfDay) || 0));
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  const due = buildDueAt(dayKey, hh, mm);
  const dur = clampDuration(durationMinutes);

  if (task.seriesId) {
    tasks.forEach((item) => {
      if (item.seriesId !== task.seriesId) return;
      const currentDay = parseDate(item.due);
      if (!currentDay) return;
      item.due = buildDueAt(formatDayKey(currentDay), hh, mm);
      item.durationMinutes = dur;
      applyEndTime(item);
    });
    safeSave(TASKS_KEY, tasks);
    return;
  }

  task.due = due;
  task.durationMinutes = dur;
  applyEndTime(task);
  safeSave(TASKS_KEY, tasks);
}

function spanTaskAcrossDays(taskId, startDayKey, hour, days) {
  const count = Math.max(2, Math.min(30, Number(days) || 0));
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const base = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!base) return;

  const startDate = parseDateOnly(startDayKey);
  if (!startDate) return;

  const seriesId = base.seriesId || generateSeriesId();
  const originId = base.seriesOriginId || base.id;

  base.due = buildDueAt(startDayKey, hour, 0);
  base.durationMinutes = clampDuration(base.durationMinutes || 60);
  ensureSeriesFields(base, seriesId, originId);
  applyEndTime(base);

  for (let i = 1; i < count; i += 1) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const clone = cloneTaskAtSlot(base, formatDayKey(d), hour, true);
    ensureSeriesFields(clone, seriesId, originId);
    tasks.push(clone);
  }

  safeSave(TASKS_KEY, tasks);
}

function deleteTaskWithOptions(taskId) {
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!task) return;

  if (!task.seriesId) {
    if (!window.confirm("Delete this task?")) return;
    safeSave(
      TASKS_KEY,
      tasks.filter((item) => String(item.id) !== String(taskId))
    );
    return;
  }

  const choice = (window.prompt("Delete linked series: type 'one' for this occurrence, 'series' for entire series", "one") || "")
    .trim()
    .toLowerCase();
  if (!choice) return;
  if (choice === "series") {
    safeSave(
      TASKS_KEY,
      tasks.filter((item) => item.seriesId !== task.seriesId)
    );
    return;
  }
  if (choice === "one") {
    safeSave(
      TASKS_KEY,
      tasks.filter((item) => String(item.id) !== String(taskId))
    );
  }
}

function openTaskOrigin(taskId) {
  const tasks = safeLoad(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => String(item && item.id) === String(taskId));
  if (!task) return;
  const originId = task.seriesOriginId || task.id;
  window.location.href = `todo.html?focus=${encodeURIComponent(originId)}`;
}

function buildScheduleMap() {
  const map = new Map();
  const tasks = safeLoad(TASKS_KEY, []);
  const projects = safeLoad(PROJECTS_KEY, []);
  const hobbiesData = safeLoad(HOBBIES_KEY, { hobbies: [] });
  const hobbies = Array.isArray(hobbiesData.hobbies) ? hobbiesData.hobbies : [];

  if (Array.isArray(tasks)) {
    tasks.forEach((task) => {
      if (!task || task.done || !task.due) return;
      const dueDate = parseDate(task.due);
      if (!dueDate) return;
      const hasTime = /T\d{2}:\d{2}/.test(String(task.due));
      const key = formatDayKey(dueDate);
      const list = map.get(key) || [];
      list.push({
        id: task.id,
        seriesId: task.seriesId || "",
        seriesOriginId: task.seriesOriginId || task.id,
        title: task.title || "Untitled task",
        type: "Task",
        source: "task",
        time: hasTime ? formatClock(dueDate.getHours(), dueDate.getMinutes()) : "",
        hour: hasTime ? dueDate.getHours() : 9,
        minute: hasTime ? dueDate.getMinutes() : 0,
        timed: hasTime,
        durationMinutes: clampDuration(task.durationMinutes || 60),
        customColor: typeof task.customColor === "string" ? task.customColor : "",
      });
      map.set(key, list);
    });
  }

  const addWeekly = (item, label, scheduleDays, startDate, endDate) => {
    if (!Array.isArray(scheduleDays)) return;
    const start = parseDateOnly(startDate) || new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = parseDateOnly(endDate) || new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      if (!isWithinDateRange(day, startDate, endDate)) continue;
      if (!scheduleDays.includes(dayIndex(day))) continue;
      const key = formatDayKey(day);
      const list = map.get(key) || [];
      list.push({ title: item, type: label, timed: false });
      map.set(key, list);
    }
  };

  if (Array.isArray(projects)) {
    projects.forEach((entry) => {
      addWeekly(entry.title, entry.type || "Project", entry.scheduleDays, entry.startDate, entry.endDate);
    });
  }

  hobbies.forEach((hobby) => {
    addWeekly(hobby.name, "Hobby", hobby.scheduleDays, null, null);
  });

  return map;
}

function renderDayDetails(items) {
  dayDetails.innerHTML = "";
  if (!items || items.length === 0) {
    dayDetails.innerHTML = `<div class="detail-item">No scheduled items.</div>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-item";
    row.innerHTML = `
      <div class="detail-title">${item.customColor ? `<span class="color-dot" style="background:${item.customColor}"></span>` : ""}${item.title}</div>
      <div class="detail-meta">${item.type}${item.timed ? ` • ${formatClock(item.hour, item.minute)}-${endClock(item.hour, item.minute, item.durationMinutes || 60)}` : (item.time ? ` • ${item.time}` : "")}${item.durationMinutes ? ` • ${item.durationMinutes}m` : ""}${item.seriesId ? " • linked series" : ""}</div>
    `;
    dayDetails.appendChild(row);
  });
}

function renderCalendar() {
  const scheduleMap = buildScheduleMap();
  const start = startOfWeek(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
  const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const last = new Date(end);
  last.setDate(last.getDate() + (6 - dayIndex(end)));

  monthLabel.textContent = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";

  for (let day = new Date(start); day <= last; day.setDate(day.getDate() + 1)) {
    const key = formatDayKey(day);
    const list = scheduleMap.get(key) || [];
    const cell = document.createElement("div");
    cell.className = `day-cell ${day.getMonth() === viewDate.getMonth() ? "" : "outside"}`;
    const bannerItems = list.filter((item) => !item.timed);
    const timedItems = list.filter((item) => item.timed);
    cell.innerHTML = `
      <div class="day-number">${day.getDate()}</div>
      ${bannerItems.slice(0, 2).map((item) => `<div class="banner ${String(item.type).toLowerCase()}">${item.title}</div>`).join("")}
      ${timedItems.slice(0, 2).map((item) => `<div class="timed ${String(item.type).toLowerCase()}" style="${item.customColor ? `background:${item.customColor};border-color:${item.customColor};color:#fff;` : ""}">${item.time ? `${item.time} ` : ""}${item.title}</div>`).join("")}
    `;
    cell.addEventListener("click", () => renderDayDetails(list));
    calendarGrid.appendChild(cell);
  }
}

function attachResizeHandle(block, item, dayKey) {
  const bottomHandle = document.createElement("div");
  bottomHandle.className = "resize-handle";

  const topHandle = document.createElement("div");
  topHandle.className = "resize-handle resize-handle-top";

  const redraw = (startMinute, duration) => {
    const nextDuration = clampDuration(duration);
    const start = Math.max(0, Math.min(23 * 60 + 59, Number(startMinute) || 0));
    item.hour = Math.floor(start / 60);
    item.minute = start % 60;
    block.style.marginTop = `${Math.round((item.minute / 60) * SLOT_HEIGHT)}px`;
    block.style.height = `${Math.max(24, (nextDuration / 60) * SLOT_HEIGHT)}px`;
    block.dataset.duration = String(nextDuration);
    block.dataset.startMinute = String(start);
    block.textContent = taskRangeLabel(item, nextDuration);
    block.appendChild(topHandle);
    block.appendChild(bottomHandle);
  };

  redraw((Number(item.hour || 0) * 60) + Number(item.minute || 0), item.durationMinutes || 60);

  bottomHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startDuration = clampDuration(item.durationMinutes || 60);

    const onMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const minutesDelta = Math.round((deltaY / SLOT_HEIGHT) * 60 / 15) * 15;
      const nextDuration = clampDuration(startDuration + minutesDelta);
      redraw((Number(item.hour || 0) * 60) + Number(item.minute || 0), nextDuration);
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      saveTaskDuration(item.id, Number(block.dataset.duration || item.durationMinutes || 60));
      updateView();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  });

  topHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startMinute = (Number(item.hour || 0) * 60) + Number(item.minute || 0);
    const startDuration = clampDuration(item.durationMinutes || 60);
    const endMinute = startMinute + startDuration;

    const onMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMinutes = Math.round((deltaY / SLOT_HEIGHT) * 60 / 15) * 15;
      let nextStart = startMinute + deltaMinutes;
      nextStart = Math.max(0, Math.min(endMinute - MIN_DURATION, nextStart));
      let nextDuration = endMinute - nextStart;
      if (nextDuration > MAX_DURATION) {
        nextDuration = MAX_DURATION;
        nextStart = endMinute - nextDuration;
      }
      redraw(nextStart, nextDuration);
    };

    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      const sm = Number(block.dataset.startMinute || startMinute);
      const dur = Number(block.dataset.duration || startDuration);
      saveTaskTiming(item.id, dayKey, sm, dur);
      updateView();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  });
}

function renderWeekView() {
  const scheduleMap = buildScheduleMap();
  const weekStart = startOfWeek(new Date(viewDate));
  const hours = Array.from({ length: 24 }, (_, i) => i);
  weekView.innerHTML = "";

  const headerRow = document.createElement("div");
  headerRow.className = "week-header";
  headerRow.innerHTML = "<span>Week</span>";
  weekView.appendChild(headerRow);

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const header = document.createElement("div");
    header.className = "week-header";
    header.innerHTML = `<span>${day.toLocaleDateString("en-US", { weekday: "short" })}</span>${day.getDate()}`;
    weekView.appendChild(header);
  }

  const timeCol = document.createElement("div");
  timeCol.className = "time-col";
  hours.forEach((hour) => {
    const slot = document.createElement("div");
    slot.className = "time-slot";
    slot.textContent = `${String(hour).padStart(2, "0")}:00`;
    timeCol.appendChild(slot);
  });
  weekView.appendChild(timeCol);

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const key = formatDayKey(day);
    const list = (scheduleMap.get(key) || []).sort((a, b) => {
      const aMin = (Number(a.hour || 0) * 60) + Number(a.minute || 0);
      const bMin = (Number(b.hour || 0) * 60) + Number(b.minute || 0);
      return aMin - bMin;
    });
    const dayCol = document.createElement("div");
    dayCol.className = "week-day";

    hours.forEach((hour) => {
      const cell = document.createElement("div");
      cell.className = "week-cell";
      cell.dataset.day = key;
      cell.dataset.hour = String(hour);
      cell.addEventListener("dragover", (event) => {
        event.preventDefault();
        cell.classList.add("drag-over");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
      cell.addEventListener("drop", (event) => {
        event.preventDefault();
        cell.classList.remove("drag-over");
        const taskId = event.dataTransfer?.getData("text/task-id") || activeDragTaskId;
        if (!taskId) return;
        const copyMode = Boolean(event.altKey || event.ctrlKey);
        saveTaskDueAtSlot(taskId, key, hour, copyMode);
        activeDragTaskId = null;
        updateView();
      });

      list
        .filter((item) => (item.timed ? Number(item.hour) === hour : hour === 9))
        .forEach((item) => {
          const block = document.createElement("div");
          block.className = `week-item week-item-block ${String(item.type).toLowerCase()}`;
          block.textContent = taskRangeLabel(item, item.durationMinutes);
          if (item.customColor) {
            block.style.background = item.customColor;
            block.style.borderColor = item.customColor;
            block.style.color = "#ffffff";
          }
          if (item.seriesId) block.classList.add("series-item");
          if (item.timed) {
            const offsetPx = Math.round((Number(item.minute || 0) / 60) * SLOT_HEIGHT);
            const heightPx = Math.max(24, Math.round((clampDuration(item.durationMinutes || 60) / 60) * SLOT_HEIGHT));
            block.style.marginTop = `${offsetPx}px`;
            block.style.height = `${heightPx}px`;
            block.dataset.duration = String(clampDuration(item.durationMinutes || 60));
          }

          if (item.source === "task" && item.id) {
            block.classList.add("draggable");
            block.draggable = true;
            block.title = "Double-click: open origin task. Shift + double-click: span days. Right-click: delete one or series. Alt/Ctrl + drop: copy.";
            block.addEventListener("dragstart", (event) => {
              activeDragTaskId = item.id;
              event.dataTransfer?.setData("text/task-id", String(item.id));
              if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
            });
            block.addEventListener("dragend", () => {
              activeDragTaskId = null;
              weekView.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
            });
            block.addEventListener("dblclick", (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.shiftKey) {
                const input = window.prompt("Span this task across how many days? (2-30)", "2");
                if (!input) return;
                const days = Number(input);
                if (!Number.isFinite(days) || days < 2) return;
                spanTaskAcrossDays(item.id, key, hour, days);
                updateView();
                return;
              }
              openTaskOrigin(item.id);
            });
            block.addEventListener("contextmenu", (event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteTaskWithOptions(item.id);
              updateView();
            });
            if (item.timed) attachResizeHandle(block, item, key);
          }

          cell.appendChild(block);
        });

      dayCol.appendChild(cell);
    });

    weekView.appendChild(dayCol);
  }
}

function updateView() {
  if (viewMode === "month") {
    calendarGrid.classList.remove("hidden");
    weekView.classList.add("hidden");
    renderCalendar();
  } else {
    calendarGrid.classList.add("hidden");
    weekView.classList.remove("hidden");
    renderWeekView();
  }
}

prevPeriod.addEventListener("click", () => {
  if (viewMode === "month") {
    viewDate.setMonth(viewDate.getMonth() - 1);
  } else {
    viewDate.setDate(viewDate.getDate() - 7);
  }
  updateView();
});

nextPeriod.addEventListener("click", () => {
  if (viewMode === "month") {
    viewDate.setMonth(viewDate.getMonth() + 1);
  } else {
    viewDate.setDate(viewDate.getDate() + 7);
  }
  updateView();
});

monthViewBtn.addEventListener("click", () => {
  viewMode = "month";
  updateView();
});

weekViewBtn.addEventListener("click", () => {
  viewMode = "week";
  updateView();
});

function setShortcutsOpen(open) {
  if (!shortcutsPanel) return;
  if (open) shortcutsPanel.classList.remove("hidden");
  else shortcutsPanel.classList.add("hidden");
}

if (helpToggleBtn) {
  helpToggleBtn.addEventListener("click", () => setShortcutsOpen(true));
}

if (shortcutsCloseBtn) {
  shortcutsCloseBtn.addEventListener("click", () => setShortcutsOpen(false));
}

if (shortcutsPanel) {
  shortcutsPanel.addEventListener("click", (event) => {
    if (event.target === shortcutsPanel) setShortcutsOpen(false);
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setShortcutsOpen(false);
});
function initCalendar() {
  initQuickAdd();
  seedCalendarDemoDataIfNeeded();
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    updateView();
    return;
  }
  if (typeof initStorage === "function") {
    initStorage().then(updateView).catch(updateView);
  } else {
    updateView();
  }
}

initCalendar();









