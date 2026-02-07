const form = document.getElementById("hobbyForm");
const nameInput = document.getElementById("hobbyName");
const typeInput = document.getElementById("hobbyType");
const iconInput = document.getElementById("hobbyIcon");
const timeInput = document.getElementById("hobbyTime");
const hobbyGrid = document.getElementById("hobbyGrid");
const hobbyDeleteBtn = document.getElementById("hobbyDelete");
const hobbyCancelBtn = document.getElementById("hobbyCancel");
const formToggle = document.getElementById("hobbyFormToggle");
const formWrap = document.getElementById("hobbyFormWrap");
const STORAGE_KEY = "hobbyTracker";
const PRESS_DELAY = 700;

const iconMap = {
  music: "??",
  fitness: "??",
  art: "??",
  learning: "??",
  mindfulness: "??",
  craft: "??",
  custom: "?",
};

let data = { hobbies: [] };
let editingId = null;
let formOpen = false;

function saveDataState() {
  saveData(STORAGE_KEY, data);
}

function normalizeData() {
  if (!data || typeof data !== "object") data = { hobbies: [] };
  if (!Array.isArray(data.hobbies)) data.hobbies = [];
  data.hobbies.forEach((hobby) => {
    if (!hobby.history) hobby.history = {};
    if (!hobby.type) hobby.type = "custom";
    if (!hobby.icon) hobby.icon = iconMap[hobby.type] || "?";
    if (!hobby.timeMinutes) hobby.timeMinutes = 30;
    if (!Array.isArray(hobby.scheduleDays)) hobby.scheduleDays = [];
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function markCompleted(hobby) {
  const key = todayKey();
  hobby.history[key] = true;
  if (navigator.vibrate) navigator.vibrate(20);
  saveDataState();
  render();
}

function isCompletedToday(hobby) {
  return !!hobby.history[todayKey()];
}

function streakFor(hobby) {
  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  while (true) {
    const key = current.toISOString().slice(0, 10);
    if (hobby.history[key]) {
      streak += 1;
      current.setDate(current.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function renderCalendar(target, hobby) {
  target.innerHTML = "";
  const days = 84;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    const completed = hobby.history && hobby.history[key];
    const cell = document.createElement("div");
    cell.className = "day";
    if (completed) cell.classList.add("level-2");
    cell.title = `${key} - ${completed ? "done" : "missed"}`;
    target.appendChild(cell);
  }
}

function render() {
  normalizeData();
  hobbyGrid.innerHTML = "";
  if (data.hobbies.length === 0) {
    hobbyGrid.innerHTML = `<div class="hobby-card">No hobbies yet.</div>`;
    return;
  }

  data.hobbies.forEach((hobby) => {
    const card = document.createElement("div");
    card.className = `hobby-card ${isCompletedToday(hobby) ? "active" : ""}`;
    const dayLabels = ["M", "T", "W", "TH", "F", "Sa", "Su"];
    const scheduleButtons = dayLabels
      .map((label, index) => {
        const active = hobby.scheduleDays.includes(index);
        return `<button class="day-btn ${active ? "active" : ""}" data-hobby-day="${
          hobby.id
        }" data-day="${index}" type="button">${label}</button>`;
      })
      .join("");

    card.innerHTML = `
      <div class="icon">${hobby.icon}</div>
      <div class="hobby-title">${hobby.name}</div>
      <div class="hobby-meta">Type: ${hobby.type}</div>
      <div class="hobby-meta">Approx: ${hobby.timeMinutes} min</div>
      <div class="streak">Streak: <span class="count">${streakFor(hobby)}</span> days</div>
      <div class="hobby-meta">Weekly schedule</div>
      <div class="week-row">${scheduleButtons}</div>
      <div class="hobby-actions">
        <button class="btn" data-edit="${hobby.id}" type="button">Edit</button>
      </div>
    `;

    let timer = null;
    const startPress = () => {
      if (timer) clearTimeout(timer);
      card.classList.add("pressing");
      timer = setTimeout(() => markCompleted(hobby), PRESS_DELAY);
    };
    const cancelPress = () => {
      if (timer) clearTimeout(timer);
      card.classList.remove("pressing");
      timer = null;
    };

    card.addEventListener("mousedown", startPress);
    card.addEventListener("touchstart", startPress);
    card.addEventListener("mouseup", cancelPress);
    card.addEventListener("mouseleave", cancelPress);
    card.addEventListener("touchend", cancelPress);
    card.addEventListener("touchcancel", cancelPress);

    const calendarWrap = document.createElement("div");
    calendarWrap.className = "hobby-calendar";
    calendarWrap.innerHTML = `<div class="calendar-title">Progress</div>`;
    const calendarGrid = document.createElement("div");
    calendarGrid.className = "calendar";
    calendarWrap.appendChild(calendarGrid);
    card.appendChild(calendarWrap);
    renderCalendar(calendarGrid, hobby);

    hobbyGrid.appendChild(card);
  });
}

function addHobby(event) {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const type = typeInput.value;
  const icon = iconInput.value.trim() || iconMap[type] || "?";
  const timeMinutes = Math.max(5, Number(timeInput.value) || 30);

  if (editingId) {
    const hobby = data.hobbies.find((item) => item.id === editingId);
    if (hobby) {
      hobby.name = name;
      hobby.type = type;
      hobby.icon = icon;
      hobby.timeMinutes = timeMinutes;
    }
  } else {
    const hobby = {
      id: crypto.randomUUID(),
      name,
      type,
      icon,
      timeMinutes,
      history: {},
      scheduleDays: [],
    };
    data.hobbies.unshift(hobby);
  }

  editingId = null;
  saveDataState();
  form.reset();
  typeInput.value = "music";
  timeInput.value = "30";
  hobbyDeleteBtn.classList.add("hidden");
  render();
  setFormOpen(false);
}

form.addEventListener("submit", addHobby);
hobbyGrid.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-hobby-day]")) {
    const hobbyId = target.dataset.hobbyDay;
    const dayIndex = Number(target.dataset.day);
    const hobby = data.hobbies.find((item) => item.id === hobbyId);
    if (hobby && Number.isFinite(dayIndex)) {
      if (!Array.isArray(hobby.scheduleDays)) hobby.scheduleDays = [];
      if (hobby.scheduleDays.includes(dayIndex)) {
        hobby.scheduleDays = hobby.scheduleDays.filter((day) => day !== dayIndex);
      } else {
        hobby.scheduleDays = [...hobby.scheduleDays, dayIndex].sort();
      }
      saveDataState();
      render();
    }
  }
  if (target.matches("button[data-edit]")) {
    const hobbyId = target.dataset.edit;
    const hobby = data.hobbies.find((item) => item.id === hobbyId);
    if (hobby) {
      nameInput.value = hobby.name;
      typeInput.value = hobby.type;
      iconInput.value = hobby.icon;
      timeInput.value = hobby.timeMinutes;
      editingId = hobbyId;
      hobbyDeleteBtn.classList.remove("hidden");
      setFormOpen(true);
    }
  }
});

hobbyDeleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Delete this hobby?")) return;
  data.hobbies = data.hobbies.filter((item) => item.id !== editingId);
  editingId = null;
  saveDataState();
  form.reset();
  hobbyDeleteBtn.classList.add("hidden");
  render();
  setFormOpen(false);
});

hobbyCancelBtn.addEventListener("click", () => {
  editingId = null;
  form.reset();
  typeInput.value = "music";
  timeInput.value = "30";
  hobbyDeleteBtn.classList.add("hidden");
  setFormOpen(false);
});

function setFormOpen(open) {
  if (!formWrap || !formToggle) return;
  formOpen = open;
  formWrap.classList.toggle("collapsed", !open);
  formToggle.setAttribute("aria-expanded", String(open));
}

if (formToggle && formWrap) {
  setFormOpen(false);
  formToggle.addEventListener("click", () => setFormOpen(!formOpen));
  formWrap.addEventListener("focusin", () => setFormOpen(true));
}

initStorage().then(() => {
  data = loadData(STORAGE_KEY, { hobbies: [] });
  normalizeData();
  hobbyDeleteBtn.classList.add("hidden");
  render();
});
