const form = document.getElementById("journalForm");
const titleInput = document.getElementById("entryTitle");
const bodyInput = document.getElementById("entryBody");
const tagsInput = document.getElementById("entryTags");
const entryDateInput = document.getElementById("entryDate");
const prevDayBtn = document.getElementById("prevDay");
const nextDayBtn = document.getElementById("nextDay");
const suggestions = document.getElementById("suggestions");
const linkedItems = document.getElementById("linkedItems");
const refreshLinksBtn = document.getElementById("refreshLinks");
const searchInput = document.getElementById("searchInput");
const entriesList = document.getElementById("entriesList");
const formToggle = document.getElementById("journalFormToggle");
const formWrap = document.getElementById("journalFormWrap");

const JOURNAL_KEY = "journalEntries";
const PROJECTS_KEY = "dashboardEntries";
const TASKS_KEY = "todoTasks";
const HOBBIES_KEY = "hobbyTracker";

let entriesByDate = {};
let linkItems = [];
let currentLinks = [];
let formOpen = false;

function loadEntries() {
  const data = loadData(JOURNAL_KEY, { byDate: {} });
  if (Array.isArray(data)) {
    const migrated = {};
    data.forEach((entry) => {
      const key = entry.createdAt ? entry.createdAt.slice(0, 10) : todayKey();
      migrated[key] = normalizeEntry(entry);
    });
    return migrated;
  }
  if (data.byDate && typeof data.byDate === "object") {
    const normalized = {};
    Object.entries(data.byDate).forEach(([key, entry]) => {
      normalized[key] = normalizeEntry(entry);
    });
    return normalized;
  }
  if (data && typeof data === "object") {
    const normalized = {};
    Object.entries(data).forEach(([key, entry]) => {
      normalized[key] = normalizeEntry(entry);
    });
    return normalized;
  }
  return {};
}

function saveEntries() {
  saveData(JOURNAL_KEY, { byDate: entriesByDate });
}

function loadLinkItems() {
  const projects = loadData(PROJECTS_KEY, []);
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

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeEntry(entry) {
  const copy = entry && typeof entry === "object" ? { ...entry } : {};
  copy.tags = Array.isArray(copy.tags) ? copy.tags : [];
  copy.links = Array.isArray(copy.links) ? copy.links : [];
  copy.title = copy.title || "";
  copy.body = copy.body || "";
  return copy;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadEntryForDate(dateKey) {
  const entry = normalizeEntry(entriesByDate[dateKey]);
  titleInput.value = entry ? entry.title : "";
  bodyInput.value = entry ? entry.body : "";
  tagsInput.value = entry ? entry.tags.join(", ") : "";
  currentLinks = entry ? entry.links || [] : [];
  renderLinkedItems();
}

function saveEntryForDate(dateKey) {
  const entry = {
    id: entriesByDate[dateKey]?.id || crypto.randomUUID(),
    title: titleInput.value.trim(),
    body: bodyInput.value.trim(),
    tags: parseTags(tagsInput.value),
    links: [...currentLinks],
    createdAt: entriesByDate[dateKey]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  entriesByDate[dateKey] = entry;
  saveEntries();
}

function renderLinkedItems() {
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

function renderEntries() {
  const search = searchInput.value.toLowerCase();
  const entries = Object.values(entriesByDate);
  const filtered = entries.filter((entry) => {
    const matchesText =
      entry.title.toLowerCase().includes(search) ||
      entry.body.toLowerCase().includes(search);
    const matchesTags = entry.tags.join(" ").toLowerCase().includes(search);
    return matchesText || matchesTags;
  });

  entriesList.innerHTML = "";
  if (filtered.length === 0) {
    entriesList.innerHTML = `<div class="entry">No journal entries yet.</div>`;
    return;
  }

  filtered.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "entry";
    const tagHtml = entry.tags.length
      ? entry.tags.map((tag) => `<span class="tag" data-tag="${tag}">${tag}</span>`).join("")
      : "<span class=\"entry-meta\">No tags</span>";
    const linkHtml = entry.links.length
      ? entry.links
          .map((link) => {
            const found = linkItems.find((item) => `${item.source}:${item.id}` === link);
            if (!found) return `<span class="link-pill">Linked item</span>`;
            const href = linkHrefForItem(found);
            return `<a class="link-pill" href="${href}">${found.label}</a>`;
          })
          .join("")
      : "<span class=\"entry-meta\">No linked items</span>";
    const bodyHtml = renderBodyWithLinks(entry.body);
    item.innerHTML = `
      <div class="entry-title">
        <span>${entry.title || "Untitled"}</span>
        <span class="entry-meta">${new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <div>${bodyHtml}</div>
      <div>${tagHtml}</div>
      <div>${linkHtml}</div>
    `;
    entriesList.appendChild(item);
  });
}

function addEntry(event) {
  event.preventDefault();
  const dateKey = entryDateInput.value || todayKey();
  saveEntryForDate(dateKey);
  renderEntries();
  setFormOpen(false);
}

function updateDate(offset) {
  const current = entryDateInput.value || todayKey();
  const date = new Date(`${current}T00:00:00`);
  date.setDate(date.getDate() + offset);
  entryDateInput.value = date.toISOString().slice(0, 10);
  loadEntryForDate(entryDateInput.value);
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
    option.addEventListener("click", () => {
      onSelect(item, mode);
    });
    suggestions.appendChild(option);
  });
  suggestions.classList.add("active");
}

function handleSlashCommands() {
  const value = bodyInput.value;
  const match = value.match(/[\\/](project|task|hobby|hobbies|learning):([^\s]*)$/i);
  if (!match && /[\\/]$/i.test(value)) {
    const typeOptions = [
      { label: "project", source: "type" },
      { label: "learning", source: "type" },
      { label: "task", source: "type" },
      { label: "hobby", source: "type" },
    ];
    setSuggestions(typeOptions, "type", (item) => {
      const nextValue = value.replace(/[\\/]$/, `/${item.label}:`);
      bodyInput.value = nextValue === value ? `${value}/${item.label}:` : nextValue;
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
    const current = bodyInput.value;
    const replaced = current.replace(
      /[\\/](project|task|hobby|hobbies|learning):[^\s]*$/i,
      `/${mode}:${item.label}`
    );
    bodyInput.value = replaced;
    const linkId = `${item.source}:${item.id}`;
    if (!currentLinks.includes(linkId)) currentLinks.push(linkId);
    renderLinkedItems();
    suggestions.classList.remove("active");
  });
}

function linkHrefForItem(item) {
  if (item.source === "project") return `projects.html?focus=${encodeURIComponent(item.id)}`;
  if (item.source === "task") return `todo.html?focus=${encodeURIComponent(item.id)}`;
  if (item.source === "hobby") return `hobbies.html?focus=${encodeURIComponent(item.id)}`;
  return "index.html";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBodyWithLinks(body) {
  if (!body) return "<em>No details</em>";
  const escaped = escapeHtml(body);
  const pattern = /\/(project|learning|task|hobby|hobbies):([^\s<]+)/gi;
  return escaped.replace(pattern, (match, rawType, rawLabel) => {
    const type = rawType.toLowerCase() === "hobbies" ? "hobby" : rawType.toLowerCase();
    const label = rawLabel.trim();
    const found = linkItems.find((item) => {
      if (type === "project") {
        return (
          item.source === "project" &&
          String(item.type).toLowerCase() !== "learning" &&
          item.label.toLowerCase() === label.toLowerCase()
        );
      }
      if (type === "learning") {
        return (
          item.source === "project" &&
          String(item.type).toLowerCase() === "learning" &&
          item.label.toLowerCase() === label.toLowerCase()
        );
      }
      if (type === "task") return item.source === "task" && item.label.toLowerCase() === label.toLowerCase();
      return item.source === "hobby" && item.label.toLowerCase() === label.toLowerCase();
    });
    if (!found) return match;
    const href = linkHrefForItem(found);
    return `<a class="inline-link" href="${href}">${match}</a>`;
  });
}

form.addEventListener("submit", addEntry);
refreshLinksBtn.addEventListener("click", () => {
  loadLinkItems();
  renderLinkedItems();
});
searchInput.addEventListener("input", renderEntries);
bodyInput.addEventListener("input", handleSlashCommands);
linkedItems.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-remove]")) {
    currentLinks = currentLinks.filter((link) => link !== target.dataset.remove);
    renderLinkedItems();
  }
});
prevDayBtn.addEventListener("click", () => updateDate(-1));
nextDayBtn.addEventListener("click", () => updateDate(1));
entryDateInput.addEventListener("change", () => loadEntryForDate(entryDateInput.value));
entriesList.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("[data-tag]")) {
    searchInput.value = target.dataset.tag;
    renderEntries();
  }
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
  entriesByDate = loadEntries();
  loadLinkItems();
  entryDateInput.value = todayKey();
  loadEntryForDate(entryDateInput.value);
  renderEntries();
});
