const form = document.getElementById("taskForm");
const titleInput = document.getElementById("taskTitle");
const priorityInput = document.getElementById("taskPriority");
const dueInput = document.getElementById("taskDue");
const notesInput = document.getElementById("taskNotes");
const tagsInput = document.getElementById("taskTags");
const checklistInput = document.getElementById("taskChecklist");
const suggestions = document.getElementById("taskSuggestions");
const linkedItems = document.getElementById("taskLinkedItems");
const taskList = document.getElementById("taskList");
const taskDeleteBtn = document.getElementById("taskDelete");
const taskCancelBtn = document.getElementById("taskCancel");
const scheduleDateInput = document.getElementById("scheduleDate");
const prevScheduleDayBtn = document.getElementById("prevScheduleDay");
const nextScheduleDayBtn = document.getElementById("nextScheduleDay");
const scheduleWeek = document.getElementById("scheduleWeek");
const scheduledList = document.getElementById("scheduledList");
const archiveList = document.getElementById("archiveList");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const searchInput = document.getElementById("searchInput");
const quickButtons = document.querySelectorAll("[data-quick]");
const formToggle = document.getElementById("taskFormToggle");
const formWrap = document.getElementById("taskFormWrap");
const formCard = document.getElementById("taskFormCard");

const STORAGE_KEY = "todoTasks";
const ARCHIVE_KEY = "todoArchive";
const PROJECTS_KEY = "dashboardEntries";
const HOBBIES_KEY = "hobbyTracker";

let tasks = [];
let archive = [];
let editingId = null;
let linkItems = [];
let currentLinks = [];
let formOpen = false;

function loadTasks() {
  const data = loadData(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.map((task) => ({
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    linkedItems: Array.isArray(task.linkedItems) ? task.linkedItems : [],
    checklist: normalizeChecklist(task.checklist),
  }));
}

function saveTasks() {
  saveData(STORAGE_KEY, tasks);
}

function loadArchive() {
  const data = loadData(ARCHIVE_KEY, []);
  return Array.isArray(data) ? data : [];
}

function saveArchive() {
  saveData(ARCHIVE_KEY, archive);
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

function formatDue(dateValue) {
  if (!dateValue) return "No due date";
  const date = parseDate(dateValue);
  return date ? date.toLocaleString() : "No due date";
}

function formatCompletedAt(dateValue) {
  if (!dateValue) return "";
  const date = parseDate(dateValue);
  return date ? date.toLocaleString() : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeChecklist(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        return { id: generateId(), text, done: false, completedAt: null };
      }
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || "").trim();
      if (!text) return null;
      const done = Boolean(item.done);
      return {
        id: item.id || generateId(),
        text,
        done,
        completedAt: done ? item.completedAt || item.updatedAt || null : null,
      };
    })
    .filter(Boolean);
}

function parseChecklistInput(value, existingChecklist = []) {
  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const existing = [...normalizeChecklist(existingChecklist)];
  return lines.map((text) => {
    const index = existing.findIndex(
      (item) => item.text.toLowerCase() === text.toLowerCase()
    );
    if (index !== -1) {
      const [found] = existing.splice(index, 1);
      return { ...found, text };
    }
    return { id: generateId(), text, done: false, completedAt: null };
  });
}

function renderChecklist(task) {
  const checklist = normalizeChecklist(task.checklist);
  if (!checklist.length) return "";
  const items = checklist
    .map((item) => {
      const completedAt = formatCompletedAt(item.completedAt);
      return `
      <label class="checklist-item ${item.done ? "done" : ""}">
        <input type="checkbox" data-check-task="${task.id}" data-check-item="${item.id}" ${
        item.done ? "checked" : ""
      } />
        <span class="checklist-content">
          <span class="checklist-text">${escapeHtml(item.text)}</span>
          <span class="checklist-time ${item.done && completedAt ? "" : "hidden"}">${
        item.done && completedAt ? `Completed: ${escapeHtml(completedAt)}` : ""
      }</span>
        </span>
      </label>`;
    })
    .join("");
  return `<div class="checklist">${items}</div>`;
}

function renderArchiveChecklist(task) {
  const checklist = normalizeChecklist(task.checklist);
  if (!checklist.length) return "";
  const items = checklist
    .map((item) => {
      const completedAt = formatCompletedAt(item.completedAt);
      return `<li class="${item.done ? "done" : ""}">${escapeHtml(item.text)}${
        item.done && completedAt
          ? ` <span class="checklist-time">(Completed: ${escapeHtml(completedAt)})</span>`
          : ""
      }</li>`;
    })
    .join("");
  return `<ul class="archive-checklist">${items}</ul>`;
}

function comparePriority(a, b) {
  const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
  return (order[a] || 9) - (order[b] || 9);
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const dueA = a.due || "";
    const dueB = b.due || "";
    if (dueA === dueB) {
      const priorityCompare = comparePriority(a.priority, b.priority);
      if (priorityCompare !== 0) return priorityCompare;
      return a.title.localeCompare(b.title);
    }
    if (!dueA) return 1;
    if (!dueB) return -1;
    return dueA.localeCompare(dueB);
  });
}

function isOverdue(task) {
  if (task.done) return false;
  const dueDate = parseDate(task.due);
  if (!dueDate) return false;
  return dueDate < new Date();
}

function dayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function renderScheduleWeek(date) {
  const labels = ["M", "T", "W", "TH", "F", "Sa", "Su"];
  scheduleWeek.innerHTML = "";
  labels.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-btn ${dayIndex(date) === index ? "active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      const current = new Date(date);
      const offset = index - dayIndex(current);
      current.setDate(current.getDate() + offset);
      scheduleDateInput.value = current.toISOString().slice(0, 10);
      renderScheduleWeek(current);
      renderScheduledItems();
    });
    scheduleWeek.appendChild(button);
  });
}

function getScheduleDate() {
  const value = scheduleDateInput.value;
  const parsed = parseDateOnly(value);
  return parsed || new Date();
}

function isWithinDateRange(date, startValue, endValue) {
  const start = parseDateOnly(startValue) || new Date("1970-01-01");
  const end = parseDateOnly(endValue) || new Date("2999-12-31");
  return date >= start && date <= end;
}

function renderScheduledItems() {
  const date = getScheduleDate();
  const day = dayIndex(date);
  const projects = loadData(PROJECTS_KEY, []);
  const hobbiesData = loadData(HOBBIES_KEY, { hobbies: [] });
  const hobbies = Array.isArray(hobbiesData.hobbies) ? hobbiesData.hobbies : [];

  const scheduled = [];
  if (Array.isArray(projects)) {
    projects.forEach((entry) => {
      if (!entry || !Array.isArray(entry.scheduleDays)) return;
      if (!entry.scheduleDays.includes(day)) return;
      if (!isWithinDateRange(date, entry.startDate, entry.endDate)) return;
      scheduled.push({
        title: entry.title,
        tag: entry.type || "Project",
      });
    });
  }
  hobbies.forEach((hobby) => {
    if (!Array.isArray(hobby.scheduleDays)) return;
    if (!hobby.scheduleDays.includes(day)) return;
    scheduled.push({
      title: hobby.name,
      tag: "Hobby",
    });
  });

  scheduledList.innerHTML = "";
  if (scheduled.length === 0) {
    scheduledList.innerHTML = `<div class="task">No scheduled items.</div>`;
    return;
  }

  scheduled.forEach((item) => {
    const row = document.createElement("div");
    row.className = "task";
    row.innerHTML = `
      <div class="task-header">
        <div class="task-title">${item.title}</div>
        <span class="tag-pill">${item.tag}</span>
      </div>
      <div class="task-meta">Scheduled for ${date.toLocaleDateString()}</div>
    `;
    scheduledList.appendChild(row);
  });
}

function renderArchive() {
  archiveList.innerHTML = "";
  if (archive.length === 0) {
    archiveList.innerHTML = `<div class="task">No archived tasks.</div>`;
    return;
  }
  const sorted = sortTasks(archive).slice(0, 30);
  sorted.forEach((task) => {
    const item = document.createElement("div");
    item.className = "task";
    const checklistHtml = renderArchiveChecklist(task);
    const tagHtml = Array.isArray(task.tags) && task.tags.length
      ? task.tags
          .map(
            (tag) =>
              `<button class="tag tag-btn" type="button" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
          )
          .join("")
      : "<span class=\"task-meta\">No tags</span>";
    const linkHtml = Array.isArray(task.linkedItems) && task.linkedItems.length
      ? task.linkedItems
          .map((link) => {
            const found = linkItems.find((item) => `${item.source}:${item.id}` === link);
            if (!found) return "<span class=\"link-pill\">Linked item</span>";
            const href = linkHrefForItem(found);
            if (!href) return `<span class="link-pill">${escapeHtml(found.label)}</span>`;
            return `<a class="link-pill linked-nav" href="${href}">${escapeHtml(found.label)}</a>`;
          })
          .join("")
      : "<span class=\"task-meta\">No linked items</span>";
    item.innerHTML = `
      <div class="task-header">
        <div class="task-title done">${task.title}</div>
        <span class="badge ${task.priority.toLowerCase()}">${task.priority}</span>
      </div>
      <div class="task-meta">Completed: ${
        task.completedAt ? new Date(task.completedAt).toLocaleString() : "Unknown"
      }</div>
      <div class="task-meta">${task.notes ? task.notes : "<em>No notes</em>"}</div>
      <div>${tagHtml}</div>
      ${checklistHtml}
      <div>${linkHtml}</div>
      <div class="task-actions">
        <button class="btn" data-unarchive="${task.id}" type="button">Unarchive</button>
      </div>
    `;
    archiveList.appendChild(item);
  });
}

function renderTasks() {
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  const search = searchInput.value.toLowerCase();

  const filtered = tasks.filter((task) => {
    const statusMatch =
      status === "all" || (status === "done" ? task.done : !task.done);
    const priorityMatch = priority === "all" || task.priority === priority;
    const searchMatch =
      task.title.toLowerCase().includes(search) ||
      (task.notes || "").toLowerCase().includes(search) ||
      (Array.isArray(task.tags) ? task.tags.join(" ").toLowerCase().includes(search) : false);
    return statusMatch && priorityMatch && searchMatch;
  });

  const sorted = sortTasks(filtered);
  taskList.innerHTML = "";

  if (sorted.length === 0) {
    taskList.innerHTML = `<div class="task">No tasks yet.</div>`;
    return;
  }

  sorted.forEach((task) => {
    const item = document.createElement("div");
    item.className = `task ${isOverdue(task) ? "overdue" : ""}`;
    const tagHtml = Array.isArray(task.tags) && task.tags.length
      ? task.tags
          .map(
            (tag) =>
              `<button class="tag tag-btn" type="button" data-tag-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
          )
          .join("")
      : "<span class=\"task-meta\">No tags</span>";
    const linkHtml = Array.isArray(task.linkedItems) && task.linkedItems.length
      ? task.linkedItems
          .map((link) => {
            const found = linkItems.find((item) => `${item.source}:${item.id}` === link);
            if (!found) return "<span class=\"link-pill\">Linked item</span>";
            const href = linkHrefForItem(found);
            if (!href) return `<span class="link-pill">${escapeHtml(found.label)}</span>`;
            return `<a class="link-pill linked-nav" href="${href}">${escapeHtml(found.label)}</a>`;
          })
          .join("")
      : "<span class=\"task-meta\">No linked items</span>";
    const checklistHtml = renderChecklist(task);
    item.innerHTML = `
      <div class="task-header">
        <div class="task-title ${task.done ? "done" : ""}">${task.title}</div>
        <span class="badge ${task.priority.toLowerCase()}">${task.priority}</span>
      </div>
      <div class="task-meta">Due: ${formatDue(task.due)}</div>
      <div class="task-meta">${task.notes ? task.notes : "<em>No notes</em>"}</div>
      <div>${tagHtml}</div>
      ${checklistHtml}
      <div>${linkHtml}</div>
      <div class="task-actions">
        <label>
          <input type="checkbox" data-done="${task.id}" ${
      task.done ? "checked" : ""
    } />
          Done
        </label>
        <button class="btn" data-edit="${task.id}" type="button">Edit</button>
      </div>
    `;
    taskList.appendChild(item);
  });
}

function addTask(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  const tags = parseTags(tagsInput.value);
  if (editingId) {
    const task = tasks.find((item) => item.id === editingId);
    if (task) {
      task.title = title;
      task.priority = priorityInput.value;
      task.due = dueInput.value;
      task.notes = notesInput.value.trim();
      task.tags = tags;
      task.checklist = parseChecklistInput(checklistInput.value, task.checklist);
      task.linkedItems = [...currentLinks];
    }
  } else {
    const task = {
      id: generateId(),
      title,
      priority: priorityInput.value,
      due: dueInput.value,
      notes: notesInput.value.trim(),
      tags,
      checklist: parseChecklistInput(checklistInput.value),
      linkedItems: [...currentLinks],
      done: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
  }
  saveTasks();
  renderTasks();
  form.reset();
  priorityInput.value = "P2";
  editingId = null;
  taskDeleteBtn.classList.add("hidden");
  currentLinks = [];
  renderLinkedItems();
  setFormOpen(false);
}

function setQuickDate(type) {
  const now = new Date();
  const target = new Date(now);
  if (type === "tomorrow") target.setDate(target.getDate() + 1);
  if (type === "nextweek") target.setDate(target.getDate() + 7);
  target.setHours(9, 0, 0, 0);
  dueInput.value = target.toISOString().slice(0, 16);
}

form.addEventListener("submit", addTask);
statusFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);
searchInput.addEventListener("input", renderTasks);
notesInput.addEventListener("input", handleSlashCommands);

quickButtons.forEach((button) => {
  button.addEventListener("click", () => setQuickDate(button.dataset.quick));
});

if (prevScheduleDayBtn && nextScheduleDayBtn && scheduleDateInput) {
  prevScheduleDayBtn.addEventListener("click", () => {
    const date = getScheduleDate();
    date.setDate(date.getDate() - 1);
    scheduleDateInput.value = date.toISOString().slice(0, 10);
    renderScheduleWeek(date);
    renderScheduledItems();
  });

  nextScheduleDayBtn.addEventListener("click", () => {
    const date = getScheduleDate();
    date.setDate(date.getDate() + 1);
    scheduleDateInput.value = date.toISOString().slice(0, 10);
    renderScheduleWeek(date);
    renderScheduledItems();
  });

  scheduleDateInput.addEventListener("change", () => {
    const date = getScheduleDate();
    renderScheduleWeek(date);
    renderScheduledItems();
  });
}

taskList.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("input[data-done]")) {
    const task = tasks.find((item) => item.id === target.dataset.done);
    if (task) {
      task.done = target.checked;
      if (task.done) {
        const exists = archive.some((item) => item.id === task.id);
        if (!exists) {
          archive.unshift({ ...task, completedAt: new Date().toISOString() });
          saveArchive();
        }
        tasks = tasks.filter((item) => item.id !== task.id);
        saveTasks();
      }
      renderTasks();
      renderArchive();
    }
  }
  if (target.matches("input[data-check-task][data-check-item]")) {
    const task = tasks.find((item) => item.id === target.dataset.checkTask);
    if (!task || !Array.isArray(task.checklist)) return;
    const checklistItem = task.checklist.find(
      (item) => item.id === target.dataset.checkItem
    );
    if (!checklistItem) return;
    checklistItem.done = target.checked;
    checklistItem.completedAt = target.checked ? new Date().toISOString() : null;
    saveTasks();
    renderTasks();
  }
});

taskList.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-tag-filter]")) {
    searchInput.value = target.dataset.tagFilter || "";
    statusFilter.value = "all";
    renderTasks();
    return;
  }
  if (target.matches("button[data-edit]")) {
    const task = tasks.find((item) => item.id === target.dataset.edit);
    if (task) {
      titleInput.value = task.title;
      priorityInput.value = task.priority;
      dueInput.value = task.due || "";
      notesInput.value = task.notes || "";
      tagsInput.value = Array.isArray(task.tags) ? task.tags.join(", ") : "";
      checklistInput.value = Array.isArray(task.checklist)
        ? task.checklist.map((item) => item.text).join("\n")
        : "";
      currentLinks = Array.isArray(task.linkedItems) ? [...task.linkedItems] : [];
      renderLinkedItems();
      editingId = task.id;
      taskDeleteBtn.classList.remove("hidden");
      setFormOpen(true);
      titleInput.focus();
    }
  }
});

archiveList.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-tag-filter]")) {
    searchInput.value = target.dataset.tagFilter || "";
    statusFilter.value = "all";
    renderTasks();
    return;
  }
  if (!target.matches("button[data-unarchive]")) return;
  const taskId = target.dataset.unarchive;
  const archivedTask = archive.find((task) => task.id === taskId);
  if (!archivedTask) return;

  const restoredTask = {
    ...archivedTask,
    done: false,
    completedAt: null,
  };
  tasks = tasks.filter((task) => task.id !== taskId);
  tasks.unshift(restoredTask);
  archive = archive.filter((task) => task.id !== taskId);
  saveTasks();
  saveArchive();
  renderTasks();
  renderArchive();
});

function linkHrefForItem(item) {
  if (!item || !item.source || !item.id) return "";
  if (item.source === "project") return `projects.html?focus=${encodeURIComponent(item.id)}`;
  if (item.source === "task") return `todo.html?focus=${encodeURIComponent(item.id)}`;
  if (item.source === "hobby") return `hobbies.html?focus=${encodeURIComponent(item.id)}`;
  return "";
}

initStorage().then(() => {
  tasks = loadTasks();
  archive = loadArchive();
  loadLinkItems();
  let archiveUpdated = false;
  tasks.forEach((task) => {
    if (task.done) {
      const exists = archive.some((item) => item.id === task.id);
      if (!exists) {
        archive.unshift({ ...task, completedAt: task.completedAt || task.updatedAt || task.createdAt });
        archiveUpdated = true;
      }
    }
  });
  if (tasks.some((task) => task.done)) {
    tasks = tasks.filter((task) => !task.done);
    saveTasks();
  }
  if (archiveUpdated) saveArchive();
  const today = new Date();
  scheduleDateInput.value = today.toISOString().slice(0, 10);
  renderScheduleWeek(today);
  renderScheduledItems();
  renderTasks();
  renderArchive();
  taskDeleteBtn.classList.add("hidden");
  renderLinkedItems();
  const focusId = new URLSearchParams(window.location.search).get("focus");
  if (focusId) {
    const activeMatch = taskList.querySelector(`[data-edit="${focusId}"]`);
    const archiveMatch = archiveList.querySelector(`[data-unarchive="${focusId}"]`);
    const row = (activeMatch || archiveMatch) ? (activeMatch || archiveMatch).closest(".task") : null;
    if (row) {
      row.classList.add("focused");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
});

taskDeleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter((task) => task.id !== editingId);
  editingId = null;
  saveTasks();
  renderTasks();
  form.reset();
  priorityInput.value = "P2";
  taskDeleteBtn.classList.add("hidden");
  currentLinks = [];
  renderLinkedItems();
  setFormOpen(false);
});

taskCancelBtn.addEventListener("click", () => {
  editingId = null;
  form.reset();
  priorityInput.value = "P2";
  taskDeleteBtn.classList.add("hidden");
  currentLinks = [];
  renderLinkedItems();
  setFormOpen(false);
});

linkedItems.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-remove]")) {
    currentLinks = currentLinks.filter((link) => link !== target.dataset.remove);
    renderLinkedItems();
  }
});

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function loadLinkItems() {
  const projects = loadData(PROJECTS_KEY, []);
  const tasksData = loadData(STORAGE_KEY, []);
  const hobbiesData = loadData(HOBBIES_KEY, { hobbies: [] });
  const hobbies = Array.isArray(hobbiesData.hobbies) ? hobbiesData.hobbies : [];

  const mappedProjects = Array.isArray(projects)
    ? projects.map((item) => ({
        id: item.id,
        label: item.title || "Untitled",
        type: item.type || "Project",
        source: "project",
      }))
    : [];

  const mappedTasks = Array.isArray(tasksData)
    ? tasksData.map((item) => ({
        id: item.id,
        label: item.title || "Untitled task",
        type: item.priority || "Task",
        source: "task",
      }))
    : [];

  const mappedHobbies = hobbies.map((item) => ({
    id: item.id,
    label: item.name || "Hobby",
    type: item.type || "Hobby",
    source: "hobby",
  }));

  linkItems = [...mappedProjects, ...mappedTasks, ...mappedHobbies];
}

function renderLinkedItems() {
  linkedItems.innerHTML = "";
  if (currentLinks.length === 0) {
    linkedItems.innerHTML = `<span class="task-meta">No linked items</span>`;
    return;
  }
  currentLinks.forEach((link) => {
    const found = linkItems.find((item) => `${item.source}:${item.id}` === link);
    const label = found ? found.label : "Linked item";
    const pill = document.createElement("span");
    pill.className = "link-pill";
    pill.innerHTML = `${label} <button type="button" data-remove="${link}">x</button>`;
    linkedItems.appendChild(pill);
  });
}

function setSuggestions(list, mode, onSelect) {
  suggestions.innerHTML = "";
  if (list.length === 0) {
    suggestions.classList.remove("active");
    return;
  }
  list.forEach((item) => {
    const option = document.createElement("div");
    option.className = "suggestion";
    option.textContent = `${item.label} (${item.source})`;
    option.addEventListener("click", () => onSelect(item, mode));
    suggestions.appendChild(option);
  });
  suggestions.classList.add("active");
}

function handleSlashCommands() {
  const value = notesInput.value;
  const match = value.match(/[\\/](project|learning|task|hobby|hobbies):([^\s]*)$/i);
  if (!match && /[\\/]$/i.test(value)) {
    const typeOptions = [
      { label: "project", source: "type" },
      { label: "learning", source: "type" },
      { label: "task", source: "type" },
      { label: "hobby", source: "type" },
    ];
    setSuggestions(typeOptions, "type", (item) => {
      const nextValue = value.replace(/[\\/]$/, `/${item.label}:`);
      notesInput.value = nextValue === value ? `${value}/${item.label}:` : nextValue;
      suggestions.classList.remove("active");
    });
    return;
  }
  if (!match) {
    suggestions.classList.remove("active");
    return;
  }
  const type = match[1].toLowerCase();
  const query = match[2] ? match[2].toLowerCase() : "";
  const normalizedType = type === "hobbies" ? "hobby" : type;
  const list =
    normalizedType === "project"
      ? linkItems.filter(
          (item) => item.source === "project" && String(item.type).toLowerCase() !== "learning"
        )
      : normalizedType === "learning"
      ? linkItems.filter(
          (item) => item.source === "project" && String(item.type).toLowerCase() === "learning"
        )
      : normalizedType === "task"
      ? linkItems.filter((item) => item.source === "task")
      : linkItems.filter((item) => item.source === "hobby");
  const filtered = query
    ? list.filter((item) => item.label.toLowerCase().includes(query))
    : list;
  setSuggestions(filtered, normalizedType, (item, mode) => {
    const current = notesInput.value;
    const replaced = current.replace(
      /[\\/](project|learning|task|hobby|hobbies):[^\s]*$/i,
      `/${mode}:${item.label}`
    );
    notesInput.value = replaced;
    const linkId = `${item.source}:${item.id}`;
    if (!currentLinks.includes(linkId)) currentLinks.push(linkId);
    renderLinkedItems();
    suggestions.classList.remove("active");
  });
}

function setFormOpen(open) {
  if (!formWrap || !formToggle) return;
  formOpen = open;
  formWrap.classList.toggle("collapsed", !open);
  formToggle.setAttribute("aria-expanded", String(open));
  if (formCard) {
    formCard.classList.toggle("sticky-open", open);
  }
}

if (formToggle && formWrap) {
  setFormOpen(false);
  formToggle.addEventListener("click", () => setFormOpen(!formOpen));
  formWrap.addEventListener("focusin", () => setFormOpen(true));
}

window.addEventListener("focus", () => {
  loadLinkItems();
  renderTasks();
  renderLinkedItems();
});
