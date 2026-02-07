const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const weekView = document.getElementById("weekView");
const prevPeriod = document.getElementById("prevPeriod");
const nextPeriod = document.getElementById("nextPeriod");
const monthViewBtn = document.getElementById("monthViewBtn");
const weekViewBtn = document.getElementById("weekViewBtn");
const dayDetails = document.getElementById("dayDetails");

const TASKS_KEY = "todoTasks";
const PROJECTS_KEY = "dashboardEntries";
const HOBBIES_KEY = "hobbyTracker";

let viewDate = new Date();
viewDate.setDate(1);
viewDate.setHours(0, 0, 0, 0);
let viewMode = "month";

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
      const key = formatDayKey(dueDate);
      const list = map.get(key) || [];
      list.push({
        title: task.title,
        type: "Task",
        time: dueDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        timed: true,
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
    header.innerHTML = `<span>${day.toLocaleDateString("en-US", {
      weekday: "short",
    })}</span>${day.getDate()}`;
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
    const list = scheduleMap.get(key) || [];
    const dayCol = document.createElement("div");
    dayCol.className = "week-day";
    hours.forEach((hour) => {
      const cell = document.createElement("div");
      cell.className = "week-cell";
      list
        .filter((item) => {
          if (!item.time) return hour === 9;
          const [h] = item.time.split(":");
          return Number(h) === hour;
        })
        .forEach((item) => {
          const badge = document.createElement("div");
          badge.className = `week-item ${String(item.type).toLowerCase()}`;
          badge.textContent = item.title;
          cell.appendChild(badge);
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

initStorage().then(updateView);
