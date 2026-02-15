const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekView = document.getElementById("weekView");
const prevPeriod = document.getElementById("prevPeriod");
const nextPeriod = document.getElementById("nextPeriod");
const monthViewBtn = document.getElementById("monthViewBtn");
const weekViewBtn = document.getElementById("weekViewBtn");
const weekZoomOutBtn = document.getElementById("weekZoomOutBtn");
const weekZoomInBtn = document.getElementById("weekZoomInBtn");
const weekIntervalLabel = document.getElementById("weekIntervalLabel");
const dayDetails = document.getElementById("dayDetails");

const TASKS_KEY = "todoTasks";
const PROJECTS_KEY = "dashboardEntries";
const HOBBIES_KEY = "hobbyTracker";

let viewDate = new Date();
viewDate.setDate(1);
viewDate.setHours(0, 0, 0, 0);
let viewMode = "month";
let activeDragTaskId = null;
let selectedTaskId = null;
let pointerDrag = null;
let suppressNextClick = false;
const WEEK_INTERVAL_OPTIONS = [60, 30, 15];
let weekIntervalIndex = 1;

function startOfWeek(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function formatDayKey(date) {
  return date.toISOString().slice(0, 10);
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

function buildScheduleMap() {
  const map = new Map();
  const tasks = loadData(TASKS_KEY, []);
  const projects = loadData(PROJECTS_KEY, []);
  const hobbiesData = loadData(HOBBIES_KEY, { hobbies: [] });
  const hobbies = Array.isArray(hobbiesData.hobbies) ? hobbiesData.hobbies : [];

  if (Array.isArray(tasks)) {
    tasks.forEach((task) => {
      if (!task.due) return;
      const dueDate = parseDate(task.due);
      if (!dueDate) return;
      const hasTime = /\d{2}:\d{2}/.test(String(task.due));
      const key = formatDayKey(dueDate);
      const list = map.get(key) || [];
      list.push({
        id: task.id,
        title: task.title,
        type: "Task",
        time: hasTime
          ? dueDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          : "",
        hour: hasTime ? dueDate.getHours() : null,
        minute: hasTime ? dueDate.getMinutes() : null,
        durationMinutes: Math.max(15, Number(task.durationMinutes) || 60),
        timed: hasTime,
        source: "task",
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

function getWeekDates() {
  const weekStart = startOfWeek(new Date(viewDate));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });
}

function getWeekIntervalMinutes() {
  return WEEK_INTERVAL_OPTIONS[weekIntervalIndex];
}

function updateWeekIntervalLabel() {
  if (!weekIntervalLabel) return;
  weekIntervalLabel.textContent = `${getWeekIntervalMinutes()}m`;
}

function getUnscheduledTasks() {
  const tasks = loadData(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter((task) => !task.due)
    .map((task) => ({
      id: task.id,
      title: task.title,
      type: "Task",
      time: "",
      source: "task",
    }));
}

function saveTaskDue(taskId, dayKey, minuteOfDay) {
  if (!taskId || !dayKey || !Number.isFinite(minuteOfDay)) return;
  const tasks = loadData(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const normalizedMinute = Math.max(0, Math.min(23 * 60 + 59, Number(minuteOfDay)));
  const hh = String(Math.floor(normalizedMinute / 60)).padStart(2, "0");
  const mm = String(normalizedMinute % 60).padStart(2, "0");
  task.due = `${dayKey}T${hh}:${mm}`;
  if (!Number.isFinite(Number(task.durationMinutes))) {
    task.durationMinutes = 60;
  }
  saveData(TASKS_KEY, tasks);
}

function saveTaskDateOnly(taskId, dayKey) {
  if (!taskId || !dayKey) return;
  const tasks = loadData(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.due = dayKey;
  saveData(TASKS_KEY, tasks);
}

function updateTaskDuration(taskId, deltaMinutes) {
  if (!taskId || !Number.isFinite(deltaMinutes)) return;
  const tasks = loadData(TASKS_KEY, []);
  if (!Array.isArray(tasks)) return;
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const current = Math.max(15, Number(task.durationMinutes) || 60);
  const next = Math.max(15, Math.min(12 * 60, current + deltaMinutes));
  task.durationMinutes = next;
  saveData(TASKS_KEY, tasks);
}

function formatMinuteLabel(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createWeekItem(item, dayKey, segmentMeta = null) {
  const badge = document.createElement("div");
  const isSegment = Boolean(segmentMeta);
  const isStart = isSegment ? Boolean(segmentMeta.isStart) : true;
  const isEnd = isSegment ? Boolean(segmentMeta.isEnd) : true;
  badge.className = `week-item ${String(item.type).toLowerCase()}${isSegment ? " week-segment" : ""}${
    isStart ? " segment-start" : ""
  }${isEnd ? " segment-end" : ""}`;
  if (isStart) {
    const controls =
      item.source === "task" && item.id && item.timed
        ? `<span class="week-item-controls">
            <button class="chip-btn" data-duration-task="${item.id}" data-duration-delta="-15" type="button">-</button>
            <button class="chip-btn" data-duration-task="${item.id}" data-duration-delta="15" type="button">+</button>
          </span>`
        : "";
    badge.innerHTML = `<span class="week-item-label">${
      item.time ? `<span class="week-item-time">${item.time}</span> ${item.title}` : item.title
    }</span>${controls}`;
  }
  if (item.source === "task" && item.id) {
    if (isStart) {
      badge.classList.add("draggable");
      badge.draggable = true;
      badge.title = "Drag to schedule";
      badge.addEventListener("dragstart", (event) => {
        activeDragTaskId = item.id;
        selectedTaskId = item.id;
        event.dataTransfer?.setData("text/task-id", item.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      badge.addEventListener("dragend", () => {
        activeDragTaskId = null;
      });
      badge.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        beginPointerDrag(event, item.id, badge);
      });
    }
    badge.dataset.taskId = item.id;
    badge.dataset.dayKey = dayKey;
    if (selectedTaskId && selectedTaskId === item.id) {
      badge.classList.add("selected");
    }
  }
  return badge;
}

function clearDropHighlights() {
  weekView.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
}

function findDropTargetAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof HTMLElement)) return null;
  const timedCell = element.closest(".week-cell-drop");
  if (timedCell) return timedCell;
  const dateLane = element.closest(".week-untimed-lane[data-day]");
  if (dateLane) return dateLane;
  return null;
}

function beginPointerDrag(event, taskId, badge) {
  if (!taskId || !badge) return;
  selectedTaskId = taskId;
  activeDragTaskId = taskId;
  pointerDrag = {
    taskId,
    pointerId: event.pointerId,
    startedAtX: event.clientX,
    startedAtY: event.clientY,
    moved: false,
    lastDropTarget: null,
  };
  badge.classList.add("dragging");
  badge.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handlePointerMove(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const movedX = Math.abs(event.clientX - pointerDrag.startedAtX);
  const movedY = Math.abs(event.clientY - pointerDrag.startedAtY);
  if (movedX > 4 || movedY > 4) pointerDrag.moved = true;

  const nextTarget = findDropTargetAtPoint(event.clientX, event.clientY);
  if (pointerDrag.lastDropTarget && pointerDrag.lastDropTarget !== nextTarget) {
    pointerDrag.lastDropTarget.classList.remove("drag-over");
  }
  if (nextTarget) nextTarget.classList.add("drag-over");
  pointerDrag.lastDropTarget = nextTarget;
}

function handlePointerEnd(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const taskId = pointerDrag.taskId;
  const dropTarget = pointerDrag.lastDropTarget;
  const moved = pointerDrag.moved;
  pointerDrag = null;
  clearDropHighlights();
  weekView.querySelectorAll(".week-item.dragging").forEach((el) => el.classList.remove("dragging"));

  if (!taskId || !dropTarget || !moved) return;
  if (dropTarget.matches(".week-cell-drop")) {
    const dayKey = dropTarget.dataset.day || "";
    const minute = Number(dropTarget.dataset.minute);
    if (dayKey && Number.isFinite(minute)) {
      saveTaskDue(taskId, dayKey, minute);
      selectedTaskId = null;
      activeDragTaskId = null;
      suppressNextClick = true;
      renderWeekView();
      if (!calendarGrid.classList.contains("hidden")) renderCalendar();
    }
    return;
  }
  if (dropTarget.matches(".week-untimed-lane[data-day]")) {
    const dayKey = dropTarget.dataset.day || "";
    if (dayKey) {
      saveTaskDateOnly(taskId, dayKey);
      selectedTaskId = null;
      activeDragTaskId = null;
      suppressNextClick = true;
      renderWeekView();
      if (!calendarGrid.classList.contains("hidden")) renderCalendar();
    }
  }
}

function attachDropHandlers(element, onDrop) {
  if (!element) return;
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    element.classList.add("drag-over");
  });
  element.addEventListener("dragleave", () => {
    element.classList.remove("drag-over");
  });
  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("drag-over");
    const draggedTaskId =
      event.dataTransfer?.getData("text/task-id") || activeDragTaskId || selectedTaskId || "";
    if (!draggedTaskId) return;
    onDrop(draggedTaskId);
    selectedTaskId = null;
    activeDragTaskId = null;
    renderWeekView();
    if (!calendarGrid.classList.contains("hidden")) renderCalendar();
  });
}

function getClosestFromEvent(event, selector) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (node && node.nodeType === 1 && typeof node.matches === "function" && node.matches(selector)) {
      return node;
    }
  }
  const target = event.target;
  if (target && target.nodeType === 1 && typeof target.closest === "function") {
    return target.closest(selector);
  }
  return null;
}

function placeSelectedTaskOnCell(cell) {
  if (!selectedTaskId || !cell) return false;
  const dayKey = cell.dataset.day || "";
  const minute = Number(cell.dataset.minute);
  if (!dayKey || !Number.isFinite(minute)) return false;
  saveTaskDue(selectedTaskId, dayKey, minute);
  selectedTaskId = null;
  renderWeekView();
  if (!calendarGrid.classList.contains("hidden")) renderCalendar();
  return true;
}

function placeSelectedTaskOnDateLane(lane) {
  if (!selectedTaskId || !lane) return false;
  const dayKey = lane.dataset.day || "";
  if (!dayKey) return false;
  saveTaskDateOnly(selectedTaskId, dayKey);
  selectedTaskId = null;
  renderWeekView();
  if (!calendarGrid.classList.contains("hidden")) renderCalendar();
  return true;
}

function buildTimedRowMap(list, intervalMinutes) {
  const rowMap = new Map();
  const rowCount = (24 * 60) / intervalMinutes;
  list
    .filter((item) => item.timed)
    .forEach((item) => {
      const startMinute = Math.max(0, Math.min(24 * 60 - intervalMinutes, Number(item.hour) * 60 + Number(item.minute || 0)));
      const startRow = Math.floor(startMinute / intervalMinutes);
      const span = Math.max(1, Math.ceil((Number(item.durationMinutes) || 60) / intervalMinutes));
      for (let offset = 0; offset < span; offset += 1) {
        const row = startRow + offset;
        if (row >= rowCount) break;
        const bucket = rowMap.get(row) || [];
        bucket.push({
          item,
          isStart: offset === 0,
          isEnd: offset === span - 1 || row === rowCount - 1,
        });
        rowMap.set(row, bucket);
      }
    });
  return rowMap;
}

function renderDayDetails(key, items) {
  dayDetails.innerHTML = "";
  if (!items || items.length === 0) {
    dayDetails.innerHTML = `<div class="detail-item">No scheduled items.</div>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-item";
    row.innerHTML = `
      <div class="detail-title">${item.title}</div>
      <div class="detail-meta">${item.type}${item.time ? ` • ${item.time}` : ""}</div>
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
      ${bannerItems
        .slice(0, 2)
        .map(
          (item) =>
            `<div class="banner ${String(item.type).toLowerCase()}">${item.title}</div>`
        )
        .join("")}
      ${timedItems
        .slice(0, 2)
        .map(
          (item) => `<div class="timed ${String(item.type).toLowerCase()}">${item.title}</div>`
        )
        .join("")}
    `;
    cell.addEventListener("click", () => renderDayDetails(key, list));
    calendarGrid.appendChild(cell);
  }
}

function renderWeekView() {
  const scheduleMap = buildScheduleMap();
  const weekDates = getWeekDates();
  const unscheduledTasks = getUnscheduledTasks();
  const intervalMinutes = getWeekIntervalMinutes();
  const rows = Array.from({ length: (24 * 60) / intervalMinutes }, (_, i) => i);
  weekView.innerHTML = "";
  const weekEnd = weekDates[6];
  monthLabel.textContent = `Week of ${weekDates[0].toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
  const board = document.createElement("div");
  board.className = "week-board";

  const corner = document.createElement("div");
  corner.className = "week-header week-corner";
  corner.innerHTML = "<span>Week</span>";
  board.appendChild(corner);

  weekDates.forEach((day) => {
    const header = document.createElement("div");
    header.className = "week-header";
    header.innerHTML = `<span>${day.toLocaleDateString("en-US", {
      weekday: "short",
    })}</span>${day.getDate()}`;
    board.appendChild(header);
  });

  const unscheduledLabel = document.createElement("div");
  unscheduledLabel.className = "time-slot untimed-label";
  unscheduledLabel.textContent = "Unscheduled";
  board.appendChild(unscheduledLabel);

  const unscheduledLane = document.createElement("div");
  unscheduledLane.className = "week-untimed-lane week-unscheduled-lane";
  if (!unscheduledTasks.length) {
    unscheduledLane.innerHTML = `<span class="detail-meta">No unscheduled tasks</span>`;
  } else {
    unscheduledTasks.forEach((item) => {
      unscheduledLane.appendChild(createWeekItem(item, ""));
    });
  }
  board.appendChild(unscheduledLane);

  const untimedLabel = document.createElement("div");
  untimedLabel.className = "time-slot untimed-label";
  untimedLabel.textContent = "Date only";
  board.appendChild(untimedLabel);

  weekDates.forEach((day) => {
    const key = formatDayKey(day);
    const list = scheduleMap.get(key) || [];
    const untimedItems = list.filter((item) => !item.timed);
    const lane = document.createElement("div");
    lane.className = "week-untimed-lane";
    lane.dataset.day = key;
    untimedItems.forEach((item) => {
      lane.appendChild(createWeekItem(item, key));
    });
    attachDropHandlers(lane, (taskId) => {
      saveTaskDateOnly(taskId, key);
    });
    board.appendChild(lane);
  });

  const timedMapByDay = new Map();
  weekDates.forEach((day) => {
    const key = formatDayKey(day);
    const list = scheduleMap.get(key) || [];
    timedMapByDay.set(key, buildTimedRowMap(list, intervalMinutes));
  });

  rows.forEach((rowIndex) => {
    const minuteOfDay = rowIndex * intervalMinutes;
    const slot = document.createElement("div");
    slot.className = "time-slot";
    slot.textContent = formatMinuteLabel(minuteOfDay);
    board.appendChild(slot);

    weekDates.forEach((day) => {
      const key = formatDayKey(day);
      const timedRows = timedMapByDay.get(key) || new Map();
      const timedItems = timedRows.get(rowIndex) || [];
      const cell = document.createElement("div");
      cell.className = "week-cell week-cell-drop";
      cell.dataset.day = key;
      cell.dataset.minute = String(minuteOfDay);
      timedItems.forEach(({ item, isStart, isEnd }) => {
        cell.appendChild(createWeekItem(item, key, { isStart, isEnd }));
      });
      attachDropHandlers(cell, (taskId) => {
        saveTaskDue(taskId, key, minuteOfDay);
      });
      board.appendChild(cell);
    });
  });

  weekView.appendChild(board);
}

weekView.addEventListener("dragstart", (event) => {
  const dragItem = getClosestFromEvent(event, ".week-item.draggable");
  if (!dragItem) return;
  activeDragTaskId = dragItem.dataset.taskId || null;
  selectedTaskId = activeDragTaskId;
});

weekView.addEventListener("dragend", () => {
  activeDragTaskId = null;
});

weekView.addEventListener("pointermove", handlePointerMove);
weekView.addEventListener("pointerup", handlePointerEnd);
weekView.addEventListener("pointercancel", handlePointerEnd);

weekView.addEventListener("click", (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const control = getClosestFromEvent(event, "button[data-duration-task]");
  if (!control) return;
  const taskId = control.dataset.durationTask || "";
  const delta = Number(control.dataset.durationDelta);
  if (!taskId || !Number.isFinite(delta)) return;
  updateTaskDuration(taskId, delta);
  renderWeekView();
  if (!calendarGrid.classList.contains("hidden")) renderCalendar();
});

weekView.addEventListener("click", (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const control = getClosestFromEvent(event, "button[data-duration-task]");
  if (control) return;
  const draggableItem = getClosestFromEvent(event, ".week-item.draggable");
  if (draggableItem) {
    const taskId = draggableItem.dataset.taskId || "";
    if (!taskId) return;
    selectedTaskId = selectedTaskId === taskId ? null : taskId;
    renderWeekView();
    return;
  }
  if (placeSelectedTaskOnCell(getClosestFromEvent(event, ".week-cell-drop"))) return;
  if (placeSelectedTaskOnDateLane(getClosestFromEvent(event, ".week-untimed-lane[data-day]"))) return;
});

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

if (weekZoomOutBtn && weekZoomInBtn) {
  weekZoomOutBtn.addEventListener("click", () => {
    weekIntervalIndex = Math.max(0, weekIntervalIndex - 1);
    updateWeekIntervalLabel();
    if (viewMode === "week") renderWeekView();
  });
  weekZoomInBtn.addEventListener("click", () => {
    weekIntervalIndex = Math.min(WEEK_INTERVAL_OPTIONS.length - 1, weekIntervalIndex + 1);
    updateWeekIntervalLabel();
    if (viewMode === "week") renderWeekView();
  });
}

updateWeekIntervalLabel();
initStorage().then(updateView);
