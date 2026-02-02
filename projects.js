const form = document.getElementById("entryForm");
const typeInput = document.getElementById("entryType");
const titleInput = document.getElementById("entryTitle");
const startInput = document.getElementById("entryStart");
const endInput = document.getElementById("entryEnd");
const linksInput = document.getElementById("entryLinks");
const notesInput = document.getElementById("entryNotes");
const tagsInput = document.getElementById("entryTags");
const suggestions = document.getElementById("entrySuggestions");
const linkedItems = document.getElementById("entryLinkedItems");
const entriesList = document.getElementById("entriesList");
const ganttCanvas = document.getElementById("ganttCanvas");
const ganttWrap = document.getElementById("ganttWrap");
const zoomRange = document.getElementById("zoomRange");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const formToggle = document.getElementById("entryFormToggle");
const formWrap = document.getElementById("entryFormWrap");

const STORAGE_KEY = "dashboardEntries";
const ZOOM_KEY = "ganttZoom";
const TASKS_KEY = "todoTasks";
const HOBBIES_KEY = "hobbyTracker";
const MS_PER_HOUR = 60 * 60 * 1000;

let entries = [];
let ganttZoom = loadGanttZoom();
let editingId = null;
let linkItems = [];
let currentLinks = [];
let formOpen = false;

function normalizeEntries(items) {
  let migrated = false;
  const normalized = items.map((entry) => {
    const copy = { ...entry };
    if (!Array.isArray(copy.workSegments)) {
      if (Array.isArray(copy.workLogs)) {
        copy.workSegments = copy.workLogs
          .map((log) => {
            const date = parseDateOnly(log.date);
            if (!date) return null;
            const start = new Date(date);
            start.setHours(9, 0, 0, 0);
            const hours = Math.max(0, Math.min(24, Number(log.hours) || 0));
            const end = new Date(start.getTime() + hours * MS_PER_HOUR);
            return { start: start.toISOString(), end: end.toISOString(), source: "legacy" };
          })
          .filter(Boolean);
        migrated = true;
      } else {
        copy.workSegments = [];
        migrated = true;
      }
    }
    if (!Array.isArray(copy.scheduleDays)) {
      copy.scheduleDays = [];
      migrated = true;
    }
    if (!Array.isArray(copy.tags)) {
      copy.tags = [];
      migrated = true;
    }
    if (!Array.isArray(copy.linkedItems)) {
      copy.linkedItems = [];
      migrated = true;
    }
    return copy;
  });

  if (migrated) {
    saveData(STORAGE_KEY, normalized);
  }

  return normalized;
}

function loadEntries() {
  const data = loadData(STORAGE_KEY, []);
  if (!Array.isArray(data)) return [];
  return normalizeEntries(data);
}

function saveEntries() {
  saveData(STORAGE_KEY, entries);
}

function loadGanttZoom() {
  const stored = Number(loadData(ZOOM_KEY, 8));
  return Number.isFinite(stored) ? stored : 8;
}

function saveGanttZoom() {
  saveData(ZOOM_KEY, ganttZoom);
}

function clampZoom(value) {
  const min = Number(zoomRange.min);
  const max = Number(zoomRange.max);
  return Math.min(max, Math.max(min, value));
}

function parseDateOnly(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function parseDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function loadLinkItems() {
  const projects = loadData(STORAGE_KEY, []);
  const tasks = loadData(TASKS_KEY, []);
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

  const mappedTasks = Array.isArray(tasks)
    ? tasks.map((item) => ({
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

function renderFormLinkedItems() {
  linkedItems.innerHTML = "";
  if (currentLinks.length === 0) {
    linkedItems.innerHTML = `<span class="entry-meta">No linked items</span>`;
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

function renderEntryLinkedItems(entryId) {
  const target = entriesList.querySelector(`[data-linked="${entryId}"]`);
  if (!target) return;
  const entry = entries.find((item) => item.id === entryId);
  const links = entry && Array.isArray(entry.linkedItems) ? entry.linkedItems : [];
  target.innerHTML = "";
  if (links.length === 0) {
    target.innerHTML = `<span class="entry-meta">No linked items</span>`;
    return;
  }
  links.forEach((link) => {
    const found = linkItems.find((item) => `${item.source}:${item.id}` === link);
    const label = found ? found.label : "Linked item";
    const pill = document.createElement("span");
    pill.className = "link-pill";
    pill.innerHTML = `${label} <button type="button" data-entry="${entryId}" data-remove="${link}">x</button>`;
    target.appendChild(pill);
  });
}

function setSuggestions(target, list, mode, onSelect) {
  target.innerHTML = "";
  if (list.length === 0) {
    target.classList.remove("active");
    return;
  }
  list.forEach((item) => {
    const option = document.createElement("div");
    option.className = "suggestion";
    option.textContent = `${item.label} (${item.source})`;
    option.addEventListener("click", () => onSelect(item, mode));
    target.appendChild(option);
  });
  target.classList.add("active");
}

function getSuggestionList(type, query) {
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
  return query
    ? list.filter((item) => item.label.toLowerCase().includes(query))
    : list;
}

function handleFormSlashCommands() {
  const value = notesInput.value;
  const match = value.match(/[\\/](project|learning|task|hobby|hobbies):([^\s]*)$/i);
  if (!match && /[\\/]$/i.test(value)) {
    const typeOptions = [
      { label: "project", source: "type" },
      { label: "learning", source: "type" },
      { label: "task", source: "type" },
      { label: "hobby", source: "type" },
    ];
    setSuggestions(suggestions, typeOptions, "type", (item) => {
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
  const list = getSuggestionList(type, query);
  setSuggestions(suggestions, list, type === "hobbies" ? "hobby" : type, (item, mode) => {
    const replaced = value.replace(
      /[\\/](project|learning|task|hobby|hobbies):[^\s]*$/i,
      `/${mode}:${item.label}`
    );
    notesInput.value = replaced;
    const linkId = `${item.source}:${item.id}`;
    if (!currentLinks.includes(linkId)) currentLinks.push(linkId);
    renderFormLinkedItems();
    suggestions.classList.remove("active");
  });
}

function handleEntrySlashCommands(entryId, inputEl) {
  const value = inputEl.value;
  const match = value.match(/[\\/](project|learning|task|hobby|hobbies):([^\s]*)$/i);
  const suggestionsEl = entriesList.querySelector(`[data-suggestions="${entryId}"]`);
  if (!suggestionsEl) return;
  if (!match && /[\\/]$/i.test(value)) {
    const typeOptions = [
      { label: "project", source: "type" },
      { label: "learning", source: "type" },
      { label: "task", source: "type" },
      { label: "hobby", source: "type" },
    ];
    setSuggestions(suggestionsEl, typeOptions, "type", (item) => {
      const nextValue = value.replace(/[\\/]$/, `/${item.label}:`);
      inputEl.value = nextValue === value ? `${value}/${item.label}:` : nextValue;
      suggestionsEl.classList.remove("active");
    });
    return;
  }
  if (!match) {
    suggestionsEl.classList.remove("active");
    return;
  }
  const type = match[1].toLowerCase();
  const query = match[2] ? match[2].toLowerCase() : "";
  const list = getSuggestionList(type, query);
  setSuggestions(suggestionsEl, list, type === "hobbies" ? "hobby" : type, (item, mode) => {
    const replaced = value.replace(
      /[\\/](project|learning|task|hobby|hobbies):[^\s]*$/i,
      `/${mode}:${item.label}`
    );
    inputEl.value = replaced;
    const entry = entries.find((itemEntry) => itemEntry.id === entryId);
    if (entry) {
      const linkId = `${item.source}:${item.id}`;
      if (!entry.linkedItems.includes(linkId)) entry.linkedItems.push(linkId);
      renderEntryLinkedItems(entryId);
    }
    suggestionsEl.classList.remove("active");
  });
}

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

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addHours(date, hours) {
  const copy = new Date(date);
  copy.setTime(copy.getTime() + hours * MS_PER_HOUR);
  return copy;
}

function hoursBetween(start, end) {
  return (end - start) / MS_PER_HOUR;
}

function getEntryStart(entry) {
  return (
    parseDateOnly(entry.startDate) ||
    parseDateTime(entry.startDate) ||
    parseDateOnly(entry.endDate) ||
    parseDateTime(entry.endDate) ||
    parseDateTime(entry.createdAt)
  );
}

function getEntryEnd(entry) {
  const endDate =
    parseDateOnly(entry.endDate) ||
    parseDateTime(entry.endDate) ||
    parseDateOnly(entry.startDate) ||
    parseDateTime(entry.startDate) ||
    parseDateTime(entry.createdAt);
  if (!endDate) return null;
  return endDate.getHours() === 0 && endDate.getMinutes() === 0 ? endOfDay(endDate) : endDate;
}

function getRange(items) {
  let min = null;
  let max = null;
  items.forEach((entry) => {
    const start = getEntryStart(entry);
    const end = getEntryEnd(entry);
    if (start && end) {
      min = !min || start < min ? start : min;
      max = !max || end > max ? end : max;
    }

    if (Array.isArray(entry.workSegments)) {
      entry.workSegments.forEach((segment) => {
        const segStart = parseDateTime(segment.start);
        const segEnd = parseDateTime(segment.end);
        if (!segStart || !segEnd) return;
        min = !min || segStart < min ? segStart : min;
        max = !max || segEnd > max ? segEnd : max;
      });
    }
  });

  if (!min || !max) {
    const today = new Date();
    const start = startOfDay(today);
    return { min: addHours(start, -24), max: addHours(start, 24) };
  }

  return { min: addHours(min, -12), max: addHours(max, 12) };
}

function renderGantt() {
  const sorted = sortEntries(entries);
  const { min, max } = getRange(sorted);
  const totalHours = Math.max(1, Math.ceil(hoursBetween(min, max)));
  const labelWidth = 180;
  const headerHeight = 28;
  const rowHeight = 28;
  const width = labelWidth + totalHours * ganttZoom;
  const height = headerHeight + sorted.length * rowHeight + 20;
  const dpr = window.devicePixelRatio || 1;

  ganttCanvas.style.width = `${width}px`;
  ganttCanvas.style.height = `${height}px`;
  ganttCanvas.width = Math.floor(width * dpr);
  ganttCanvas.height = Math.floor(height * dpr);
  const ctx = ganttCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f4efe9";
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.strokeStyle = "#e4dbd2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelWidth, 0);
  ctx.lineTo(labelWidth, height);
  ctx.stroke();

  const showHours = ganttZoom >= 20;
  const showDays = ganttZoom >= 6;
  const showWeeks = ganttZoom >= 3;

  for (let hour = 0; hour <= totalHours; hour += 1) {
    const current = addHours(min, hour);
    const x = labelWidth + hour * ganttZoom;
    const isMidnight = current.getHours() === 0;
    const isWeekStart = isMidnight && current.getDay() === 1;
    const isMonthStart = isMidnight && current.getDate() === 1;

    if (showHours) {
      ctx.strokeStyle = "#f0e8df";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();
    } else if (isMidnight) {
      ctx.strokeStyle = isWeekStart ? "#d7cbbf" : "#eee7e0";
      ctx.beginPath();
      ctx.moveTo(x, headerHeight);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (showHours && hour % 6 === 0) {
      ctx.fillStyle = "#6a5f57";
      ctx.font = "10px Palatino, serif";
      const label = current.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      ctx.fillText(label, x + 2, 26);
      if (isMidnight) {
        ctx.font = "11px Palatino, serif";
        const dayLabel = current.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        });
        ctx.fillText(dayLabel, x + 2, 14);
      }
      continue;
    }

    if (!showHours && showDays && isMidnight && (isWeekStart || hour === 0)) {
      ctx.fillStyle = "#6a5f57";
      ctx.font = "12px Palatino, serif";
      const label = current.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      });
      ctx.fillText(label, x + 4, 18);
    } else if (!showDays && showWeeks && isWeekStart) {
      ctx.fillStyle = "#6a5f57";
      ctx.font = "12px Palatino, serif";
      const weekLabel = current.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      });
      ctx.fillText(weekLabel, x + 4, 18);
    } else if (!showWeeks && isMonthStart) {
      ctx.fillStyle = "#6a5f57";
      ctx.font = "12px Palatino, serif";
      const monthLabel = current.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });
      ctx.fillText(monthLabel, x + 4, 18);
    }
  }

  sorted.forEach((entry, index) => {
    const start = getEntryStart(entry);
    const end = getEntryEnd(entry);
    if (!start || !end) return;
    const xStart = labelWidth + hoursBetween(min, start) * ganttZoom;
    const xEnd = labelWidth + hoursBetween(min, end) * ganttZoom;
    const barHeight = Math.max(10, rowHeight * 0.6);
    const y = headerHeight + index * rowHeight + (rowHeight - barHeight) / 2;
    const baseColor =
      entry.type === "Learning" ? "rgba(76, 139, 217, 0.45)" : "rgba(225, 123, 80, 0.45)";
    const workColor = entry.type === "Learning" ? "#1f4d8f" : "#8a3b1f";

    ctx.fillStyle = "#1f1a17";
    ctx.font = "13px Palatino, serif";
    ctx.fillText(entry.title, 12, y + barHeight - 2);

    ctx.fillStyle = baseColor;
    ctx.fillRect(xStart, y, Math.max(6, xEnd - xStart), barHeight);

    if (Array.isArray(entry.workSegments)) {
      entry.workSegments.forEach((segment) => {
        const segStart = parseDateTime(segment.start);
        const segEnd = parseDateTime(segment.end);
        if (!segStart || !segEnd) return;
        const clampedStart = segStart < min ? min : segStart;
        const clampedEnd = segEnd > max ? max : segEnd;
        if (clampedEnd <= clampedStart) return;
        const segXStart = labelWidth + hoursBetween(min, clampedStart) * ganttZoom;
        const segXEnd = labelWidth + hoursBetween(min, clampedEnd) * ganttZoom;
        ctx.fillStyle = workColor;
        ctx.fillRect(segXStart, y, Math.max(2, segXEnd - segXStart), barHeight);
      });
    }
  });

  const now = new Date();
  if (now >= min && now <= max) {
    const x = labelWidth + hoursBetween(min, now) * ganttZoom;
    ctx.strokeStyle = "#1f1a17";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, headerHeight);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function sortEntries(items) {
  return [...items].sort((a, b) => {
    const dateA = a.startDate || a.endDate || a.createdAt;
    const dateB = b.startDate || b.endDate || b.createdAt;
    if (dateA === dateB) return a.title.localeCompare(b.title);
    return dateB.localeCompare(dateA);
  });
}

function formatDuration(start, end) {
  const hours = Math.max(0, (end - start) / MS_PER_HOUR);
  return `${Math.round(hours * 100) / 100}h`;
}

function renderWorkList(entry) {
  if (!Array.isArray(entry.workSegments) || entry.workSegments.length === 0) {
    return `<div class="entry-meta">No work logged yet.</div>`;
  }
  const withIndex = entry.workSegments.map((segment, index) => ({ segment, index }));
  withIndex.sort((a, b) => a.segment.start.localeCompare(b.segment.start));
  const items = withIndex
    .map(({ segment, index }) => {
      const start = parseDateTime(segment.start);
      const end = parseDateTime(segment.end);
      if (!start || !end) return "";
      const label = `${start.toLocaleString()} - ${end.toLocaleString()} (${formatDuration(
        start,
        end
      )})`;
      return `
        <div class="work-item">
          <span>${label}</span>
          <button class="btn" data-work-delete="${entry.id}" data-work-index="${index}" type="button">Remove</button>
        </div>
      `;
    })
    .join("");

  return `<div class="work-list">${items}</div>`;
}

function renderEntries() {
  const sorted = sortEntries(entries);
  entriesList.innerHTML = "";

  if (sorted.length === 0) {
    entriesList.innerHTML = `<div class="entry">No projects or learnings yet.</div>`;
    renderGantt();
    return;
  }

  sorted.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `entry ${entry.type.toLowerCase()}`;
    const links = entry.links
      ? entry.links
          .split(",")
          .map((link) => link.trim())
          .filter(Boolean)
      : [];

    const linksHtml = links.length
      ? `<div>${links
          .map((link) => {
            const normalized = /^(https?:\/\/)/i.test(link) ? link : `https://${link}`;
            return `<a href="${normalized}" target="_blank" rel="noreferrer">${link}</a>`;
          })
          .join("<br />")}</div>`
      : `<div><em>No links</em></div>`;

    const workList = renderWorkList(entry);
    const dayLabels = ["M", "T", "W", "TH", "F", "Sa", "Su"];
    const scheduleButtons = dayLabels
      .map((label, index) => {
        const active = entry.scheduleDays.includes(index);
        return `<button class="day-btn ${active ? "active" : ""}" data-schedule-day="${
          entry.id
        }" data-day="${index}" type="button">${label}</button>`;
      })
      .join("");

    const showDelete = editingId === entry.id ? "" : "hidden";
    const tagValue = Array.isArray(entry.tags) ? entry.tags.join(", ") : "";
    item.innerHTML = `
      <div class="entry-header" data-id="${entry.id}">
        <div class="entry-title">
          <span>${entry.title}</span>
          <span>${entry.type}</span>
        </div>
        <div class="entry-actions">
          <button class="btn" data-edit="${entry.id}" type="button">Edit</button>
          <button class="entry-toggle" type="button" aria-label="Toggle details">v</button>
        </div>
      </div>
      <div class="entry-meta">Start: ${entry.startDate || "--"} | End: ${
      entry.endDate || "--"
    }</div>
      <div class="entry-details ${editingId === entry.id ? "" : "hidden"}" data-details="${entry.id}">
        <label class="field">
          <span>Notes</span>
          <textarea data-notes="${entry.id}" rows="3">${
      entry.notes ? entry.notes : ""
    }</textarea>
        </label>
        <div class="suggestions" data-suggestions="${entry.id}"></div>
        <label class="field">
          <span>Tags (comma separated)</span>
          <input data-tags="${entry.id}" type="text" value="${tagValue}" />
        </label>
        <div class="field">
          <span>Linked items</span>
          <div class="linked-items" data-linked="${entry.id}"></div>
        </div>
        <label class="field">
          <span>Links (comma separated)</span>
          <input data-links="${entry.id}" type="text" value="${
      entry.links ? entry.links : ""
    }" />
        </label>
        <div class="field">
          <span>Weekly schedule (adds to to-do)</span>
          <div class="week-row">${scheduleButtons}</div>
        </div>
        <div class="field">
          <span>Add work segment</span>
          <div class="entry-actions">
            <input data-work-start="${entry.id}" type="datetime-local" />
            <input data-work-end="${entry.id}" type="datetime-local" />
            <button class="btn" data-work-add="${entry.id}" type="button">Add</button>
          </div>
          ${workList}
        </div>
        <label class="field">
          <span>Start date</span>
          <input data-start="${entry.id}" type="date" value="${
      entry.startDate || ""
    }" />
        </label>
        <label class="field">
          <span>End date</span>
          <input data-end="${entry.id}" type="date" value="${entry.endDate || ""}" />
        </label>
        ${linksHtml}
        <div class="entry-actions">
          <button class="btn" data-save="${entry.id}" type="button">Save</button>
          <button class="btn ${showDelete}" data-id="${entry.id}" type="button">Delete</button>
        </div>
      </div>
    `;
    entriesList.appendChild(item);
    renderEntryLinkedItems(entry.id);
  });
  renderGantt();
}

function addEntry(event) {
  event.preventDefault();
  const entry = {
    id: crypto.randomUUID(),
    type: typeInput.value,
    title: titleInput.value.trim(),
    startDate: startInput.value,
    endDate: endInput.value,
    links: linksInput.value.trim(),
    notes: notesInput.value.trim(),
    tags: parseTags(tagsInput.value),
    linkedItems: [...currentLinks],
    createdAt: new Date().toISOString(),
    workSegments: [],
    scheduleDays: [],
  };

  if (!entry.title || !entry.startDate) return;
  entries.unshift(entry);
  saveEntries();
  renderEntries();
  form.reset();
  typeInput.value = "Project";
  currentLinks = [];
  renderFormLinkedItems();
  setFormOpen(false);
}

function deleteEntry(id) {
  entries = entries.filter((entry) => entry.id !== id);
  saveEntries();
  renderEntries();
}

form.addEventListener("submit", addEntry);
notesInput.addEventListener("input", () => {
  handleFormSlashCommands();
});
linkedItems.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-remove]")) {
    currentLinks = currentLinks.filter((link) => link !== target.dataset.remove);
    renderFormLinkedItems();
  }
});
entriesList.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-edit]")) {
    const entryId = target.dataset.edit;
    editingId = editingId === entryId ? null : entryId;
    renderEntries();
    setFormOpen(true);
    return;
  }
  const header = target.closest(".entry-header");
  if (header) {
    const entryId = header.dataset.id;
    const details = entriesList.querySelector(`[data-details="${entryId}"]`);
    if (details) {
      details.classList.toggle("hidden");
      const toggle = header.querySelector(".entry-toggle");
      if (toggle) toggle.textContent = details.classList.contains("hidden") ? "v" : "^";
    }
    return;
  }
  if (target.matches("button[data-save]")) {
    const entryId = target.dataset.save;
    const notes = entriesList.querySelector(`[data-notes="${entryId}"]`);
    const links = entriesList.querySelector(`[data-links="${entryId}"]`);
    const start = entriesList.querySelector(`[data-start="${entryId}"]`);
    const end = entriesList.querySelector(`[data-end="${entryId}"]`);
    const tags = entriesList.querySelector(`[data-tags="${entryId}"]`);
    const entry = entries.find((item) => item.id === entryId);
    if (entry) {
      entry.notes = notes ? notes.value.trim() : "";
      entry.links = links ? links.value.trim() : "";
      entry.startDate = start ? start.value : "";
      entry.endDate = end ? end.value : "";
      entry.tags = tags ? parseTags(tags.value) : [];
      saveEntries();
      renderEntries();
    }
    return;
  }
  if (target.matches("button[data-work-add]")) {
    const entryId = target.dataset.workAdd;
    const startInputEl = entriesList.querySelector(`[data-work-start="${entryId}"]`);
    const endInputEl = entriesList.querySelector(`[data-work-end="${entryId}"]`);
    const entry = entries.find((item) => item.id === entryId);
    if (entry && startInputEl && endInputEl) {
      const startVal = startInputEl.value;
      const endVal = endInputEl.value;
      const start = parseDateTime(startVal);
      const end = parseDateTime(endVal);
      if (start && end && end > start) {
        entry.workSegments.push({
          start: start.toISOString(),
          end: end.toISOString(),
          source: "manual",
        });
        saveEntries();
        renderEntries();
      }
    }
    return;
  }
  if (target.matches("button[data-work-delete]")) {
    const entryId = target.dataset.workDelete;
    const index = Number(target.dataset.workIndex);
    const entry = entries.find((item) => item.id === entryId);
    if (entry && Array.isArray(entry.workSegments) && Number.isFinite(index)) {
      entry.workSegments.splice(index, 1);
      saveEntries();
      renderEntries();
    }
    return;
  }
  if (target.matches("button[data-schedule-day]")) {
    const entryId = target.dataset.scheduleDay;
    const dayIndex = Number(target.dataset.day);
    const entry = entries.find((item) => item.id === entryId);
    if (entry && Number.isFinite(dayIndex)) {
      if (!Array.isArray(entry.scheduleDays)) entry.scheduleDays = [];
      if (entry.scheduleDays.includes(dayIndex)) {
        entry.scheduleDays = entry.scheduleDays.filter((day) => day !== dayIndex);
      } else {
        entry.scheduleDays = [...entry.scheduleDays, dayIndex].sort();
      }
      saveEntries();
      renderEntries();
    }
    return;
  }
  if (target.matches("button[data-remove]")) {
    const entryId = target.dataset.entry;
    const linkId = target.dataset.remove;
    const entry = entries.find((item) => item.id === entryId);
    if (entry) {
      entry.linkedItems = (entry.linkedItems || []).filter((link) => link !== linkId);
      renderEntryLinkedItems(entryId);
    }
    return;
  }
  if (target.matches("button[data-id]")) {
    if (confirm("Delete this entry?")) {
      deleteEntry(target.dataset.id);
    }
  }
});

entriesList.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("textarea[data-notes]")) {
    handleEntrySlashCommands(target.dataset.notes, target);
  }
});

zoomRange.value = ganttZoom;
zoomRange.addEventListener("input", () => {
  ganttZoom = clampZoom(Number(zoomRange.value));
  saveGanttZoom();
  renderGantt();
});

zoomInBtn.addEventListener("click", () => {
  ganttZoom = clampZoom(ganttZoom + 2);
  zoomRange.value = ganttZoom;
  saveGanttZoom();
  renderGantt();
});

zoomOutBtn.addEventListener("click", () => {
  ganttZoom = clampZoom(ganttZoom - 2);
  zoomRange.value = ganttZoom;
  saveGanttZoom();
  renderGantt();
});

zoomResetBtn.addEventListener("click", () => {
  ganttZoom = 8;
  zoomRange.value = ganttZoom;
  saveGanttZoom();
  renderGantt();
});

ganttWrap.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      ganttZoom = clampZoom(ganttZoom + delta);
      zoomRange.value = ganttZoom;
      saveGanttZoom();
      renderGantt();
    }
  },
  { passive: false }
);

initStorage().then(() => {
  entries = loadEntries();
  loadLinkItems();
  renderEntries();
  renderFormLinkedItems();
  const focusId = new URLSearchParams(window.location.search).get("focus");
  if (focusId) {
    editingId = focusId;
    renderEntries();
    const header = entriesList.querySelector(`[data-id="${focusId}"]`);
    if (header) {
      header.scrollIntoView({ behavior: "smooth", block: "center" });
      const parent = header.closest(".entry");
      if (parent) parent.classList.add("focused");
    }
  }
});

window.addEventListener("focus", () => {
  loadLinkItems();
  renderEntries();
  renderFormLinkedItems();
});
