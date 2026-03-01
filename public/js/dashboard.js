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
const ISSUE_PREVIEW_LIMIT = 5;
const ISSUE_STORAGE_KEY = "projectIssues";
const ISSUE_META_KEY = "projectIssueMeta";
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

function issueDateStamp(date) {
  const d = date instanceof Date ? date : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function issueStatusLabel(status) {
  if (status === "in_progress") return "In Progress";
  if (status === "blocked") return "Blocked";
  if (status === "resolved") return "Resolved";
  return "Open";
}

function issueSeverityRank(level) {
  const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
  return order[String(level || "").toUpperCase()] || 9;
}

function issueStatusRank(status) {
  const order = { open: 1, in_progress: 2, blocked: 3, resolved: 4 };
  return order[String(status || "").toLowerCase()] || 9;
}

function normalizeIssue(issue) {
  const source = issue && typeof issue === "object" ? issue : {};
  const kind = String(source.kind || "bug").toLowerCase() === "fr" ? "fr" : "bug";
  return {
    id: String(source.id || ""),
    kind,
    title: String(source.title || "").trim(),
    projectId: String(source.projectId || ""),
    projectTitle: String(source.projectTitle || "General"),
    severity: String(source.severity || "P2").toUpperCase(),
    status: String(source.status || "open").toLowerCase(),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || source.createdAt || new Date().toISOString(),
    analysis: String(source.analysis || ""),
    stepsToReproduce: String(source.stepsToReproduce || ""),
    expected: String(source.expected || ""),
    actual: String(source.actual || ""),
    fixNotes: String(source.fixNotes || ""),
    impact: String(source.impact || ""),
    history: Array.isArray(source.history)
      ? source.history
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            at: entry.at || new Date().toISOString(),
            note: String(entry.note || ""),
          }))
      : [],
  };
}

function loadIssueTrackerState() {
  const raw = loadFromStorage(ISSUE_STORAGE_KEY, { issues: [] });
  if (Array.isArray(raw)) {
    return { issues: raw.map(normalizeIssue) };
  }
  const issues = Array.isArray(raw && raw.issues) ? raw.issues.map(normalizeIssue) : [];
  return { issues };
}

function saveIssueTrackerState(state) {
  const payload = {
    issues: Array.isArray(state && state.issues) ? state.issues.map(normalizeIssue) : [],
  };
  saveToStorage(ISSUE_STORAGE_KEY, payload);
}

function normalizeIssueMeta(meta) {
  const src = meta && typeof meta === "object" ? meta : {};
  return {
    date: String(src.date || ""),
    seq: Number(src.seq || 0),
    projectCodes: src.projectCodes && typeof src.projectCodes === "object" ? src.projectCodes : {},
  };
}

function readIssueMeta() {
  return normalizeIssueMeta(
    loadFromStorage(ISSUE_META_KEY, { date: "", seq: 0, projectCodes: {} })
  );
}

function writeIssueMeta(meta) {
  saveToStorage(ISSUE_META_KEY, normalizeIssueMeta(meta));
}

function toProjectCodeSeed(projectId, projectTitle) {
  const title = String(projectTitle || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!title) return "GN";
  if (title.length === 1) return `${title}X`;
  return `${title[0]}${title[1]}`;
}

function ensureUniqueProjectCode(baseCode, projectId, projectCodes) {
  const cleanBase = String(baseCode || "GN")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(2, "X")
    .slice(0, 2);
  const existingForProject = projectCodes[projectId];
  if (existingForProject) return existingForProject;
  const used = new Set(Object.values(projectCodes || {}));
  if (!used.has(cleanBase)) return cleanBase;
  const suffix = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < suffix.length; i += 1) {
    const candidate = `${cleanBase[0]}${suffix[i]}`;
    if (!used.has(candidate)) return candidate;
  }
  return cleanBase;
}

function projectCodeForIssue(projectId, projectTitle) {
  const key = String(projectId || "__general__");
  const meta = readIssueMeta();
  const nextCodes = { ...meta.projectCodes };
  if (!nextCodes[key]) {
    const base = toProjectCodeSeed(projectId, projectTitle);
    nextCodes[key] = ensureUniqueProjectCode(base, key, nextCodes);
    writeIssueMeta({ ...meta, projectCodes: nextCodes });
  }
  return nextCodes[key];
}

function nextIssueId(projectId, projectTitle, kind) {
  const stamp = issueDateStamp(new Date());
  const meta = readIssueMeta();
  const seq = meta.date === stamp ? Number(meta.seq || 0) + 1 : 1;
  const projectCode = projectCodeForIssue(projectId, projectTitle);
  writeIssueMeta({ ...meta, date: stamp, seq });
  const prefix = String(kind || "bug").toLowerCase() === "fr" ? "FR" : "BUG";
  return `${prefix}-${projectCode}-${stamp}-${String(seq).padStart(4, "0")}`;
}

function issueProjectOptions() {
  const entries = loadFromStorage("dashboardEntries", []);
  const options = [{ id: "", title: "General / Unassigned" }];
  if (!Array.isArray(entries)) return options;
  entries.forEach((entry) => {
    if (!entry) return;
    const title = String(entry.title || "").trim();
    if (!title) return;
    options.push({
      id: String(entry.id || ""),
      title,
    });
  });
  return options;
}

function populateIssueProjectSelect() {
  const select = document.getElementById("issueQuickProject");
  if (!select) return;
  const previous = select.value;
  const options = issueProjectOptions();
  select.innerHTML = "";
  options.forEach((option) => {
    const el = document.createElement("option");
    el.value = option.id;
    el.textContent = option.title;
    select.appendChild(el);
  });
  if (Array.from(select.options).some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function issueFilterValue() {
  const select = document.getElementById("issueQuickFilter");
  return select ? String(select.value || "open") : "open";
}

function issueTypeFilterValue() {
  const select = document.getElementById("issueQuickTypeFilter");
  return select ? String(select.value || "all") : "all";
}

function issueMatchesFilter(issue, filter) {
  if (filter === "all") return true;
  if (filter === "active") return issue.status === "open" || issue.status === "in_progress";
  return issue.status === "open";
}

function issueMatchesTypeFilter(issue, typeFilter) {
  if (typeFilter === "all") return true;
  return (issue.kind || "bug") === typeFilter;
}

function updateIssueStatus(issueId, status) {
  const nextStatus = String(status || "open").toLowerCase();
  const state = loadIssueTrackerState();
  let changed = false;
  state.issues = state.issues.map((issue) => {
    if (issue.id !== issueId) return issue;
    if (issue.status === nextStatus) return issue;
    changed = true;
    return {
      ...issue,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      history: [
        ...(Array.isArray(issue.history) ? issue.history : []),
        { at: new Date().toISOString(), note: `Status changed to ${issueStatusLabel(nextStatus)}` },
      ].slice(-50),
    };
  });
  if (changed) saveIssueTrackerState(state);
}

function updateIssueDetails(issueId, fields) {
  const updates = fields && typeof fields === "object" ? fields : {};
  const state = loadIssueTrackerState();
  let changed = false;
  state.issues = state.issues.map((issue) => {
    if (issue.id !== issueId) return issue;
    changed = true;
    return normalizeIssue({
      ...issue,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  });
  if (changed) saveIssueTrackerState(state);
}

function appendIssueHistory(issueId, note) {
  const text = String(note || "").trim();
  if (!text) return;
  const state = loadIssueTrackerState();
  let changed = false;
  state.issues = state.issues.map((issue) => {
    if (issue.id !== issueId) return issue;
    changed = true;
    return normalizeIssue({
      ...issue,
      updatedAt: new Date().toISOString(),
      history: [
        ...(Array.isArray(issue.history) ? issue.history : []),
        { at: new Date().toISOString(), note: text },
      ].slice(-100),
    });
  });
  if (changed) saveIssueTrackerState(state);
}

function renderIssuesPreview(target) {
  populateIssueProjectSelect();
  const state = loadIssueTrackerState();
  const filter = issueFilterValue();
  const typeFilter = issueTypeFilterValue();
  const filtered = state.issues
    .filter(
      (issue) =>
        issue && issueMatchesFilter(issue, filter) && issueMatchesTypeFilter(issue, typeFilter)
    )
    .sort((a, b) => {
      const statusDelta = issueStatusRank(a.status) - issueStatusRank(b.status);
      if (statusDelta !== 0) return statusDelta;
      const sevDelta = issueSeverityRank(a.severity) - issueSeverityRank(b.severity);
      if (sevDelta !== 0) return sevDelta;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });

  target.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "preview-empty";
    empty.textContent = "No issues in this view. Add one above.";
    target.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "preview-list";
  filtered.slice(0, ISSUE_PREVIEW_LIMIT).forEach((issue) => {
    const card = document.createElement("div");
    card.className = "issue-card";

    const head = document.createElement("div");
    head.className = "issue-head";
    const idEl = document.createElement("span");
    idEl.className = "issue-id";
    idEl.textContent = issue.id;
    const sevEl = document.createElement("span");
    sevEl.className = `preview-pill ${String(issue.severity || "P2").toLowerCase()}`;
    sevEl.textContent = issue.severity || "P2";
    const kindEl = document.createElement("span");
    const kind = issue.kind || "bug";
    kindEl.className = `preview-pill ${kind === "fr" ? "fr" : "bug"}`;
    kindEl.textContent = kind === "fr" ? "FR" : "BUG";
    head.appendChild(idEl);
    head.appendChild(sevEl);
    head.appendChild(kindEl);

    const titleEl = document.createElement("div");
    titleEl.className = "issue-title";
    titleEl.textContent = issue.title || "Untitled issue";

    const metaEl = document.createElement("div");
    metaEl.className = "issue-meta";
    const updated = issue.updatedAt ? formatShortDate(issue.updatedAt, true) : "";
    metaEl.textContent = `${issue.projectTitle || "General"} | ${issueStatusLabel(issue.status)}${updated ? ` | Updated ${updated}` : ""}`;

    const statusSelect = document.createElement("select");
    statusSelect.className = "issue-status";
    [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "blocked", label: "Blocked" },
      { value: "resolved", label: "Resolved" },
    ].forEach((option) => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      statusSelect.appendChild(el);
    });
    statusSelect.value = issue.status || "open";
    statusSelect.addEventListener("change", () => {
      updateIssueStatus(issue.id, statusSelect.value);
      renderAllPreviews();
    });

    const detailsWrap = document.createElement("details");
    detailsWrap.className = "issue-details";
    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "Details";
    detailsWrap.appendChild(detailsSummary);

    const detailsBody = document.createElement("div");
    detailsBody.className = "issue-details-body";

    function makeField(labelText, key, placeholder) {
      const wrapper = document.createElement("label");
      wrapper.className = "issue-detail-field";
      const label = document.createElement("span");
      label.textContent = labelText;
      const area = document.createElement("textarea");
      area.rows = 2;
      area.placeholder = placeholder;
      area.value = String(issue[key] || "");
      area.dataset.issueKey = key;
      wrapper.appendChild(label);
      wrapper.appendChild(area);
      return { wrapper, area };
    }

    const isFr = issue.kind === "fr";
    const analysis = makeField(
      "Analysis (optional)",
      "analysis",
      isFr ? "Why is this feature needed?" : "Why is this happening?"
    );
    const repro = makeField(
      isFr ? "Proposal Details (optional)" : "Steps To Reproduce (optional)",
      "stepsToReproduce",
      isFr ? "Requested flow and UI behavior" : "Step 1, Step 2..."
    );
    const expected = makeField("Expected (optional)", "expected", "Expected behavior");
    const actual = makeField("Actual (optional)", "actual", "What actually happened");
    const fixNotes = makeField("Fix Notes (optional)", "fixNotes", "Root cause / fix summary");
    const impact = makeField(
      isFr ? "Business/User Impact (optional)" : "Impact (optional)",
      "impact",
      isFr ? "Who benefits and why" : "What users are affected"
    );

    detailsBody.appendChild(analysis.wrapper);
    detailsBody.appendChild(repro.wrapper);
    detailsBody.appendChild(expected.wrapper);
    detailsBody.appendChild(actual.wrapper);
    detailsBody.appendChild(fixNotes.wrapper);
    detailsBody.appendChild(impact.wrapper);

    const actionsRow = document.createElement("div");
    actionsRow.className = "issue-detail-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn";
    saveBtn.textContent = "Save Details";
    actionsRow.appendChild(saveBtn);
    detailsBody.appendChild(actionsRow);

    const historyField = document.createElement("label");
    historyField.className = "issue-detail-field";
    const historyTitle = document.createElement("span");
    historyTitle.textContent = "Add History Note (optional)";
    const historyInput = document.createElement("input");
    historyInput.type = "text";
    historyInput.maxLength = 180;
    historyInput.placeholder = "Example: Reproduced on mobile Safari";
    historyField.appendChild(historyTitle);
    historyField.appendChild(historyInput);

    const historyAddBtn = document.createElement("button");
    historyAddBtn.type = "button";
    historyAddBtn.className = "btn";
    historyAddBtn.textContent = "Add Note";

    const historyList = document.createElement("div");
    historyList.className = "issue-history-list";
    const historyItems = Array.isArray(issue.history) ? issue.history.slice(-4).reverse() : [];
    if (!historyItems.length) {
      const emptyHistory = document.createElement("div");
      emptyHistory.className = "preview-empty";
      emptyHistory.textContent = "No history notes yet.";
      historyList.appendChild(emptyHistory);
    } else {
      historyItems.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "issue-history-item";
        const at = entry.at ? formatShortDate(entry.at, true) : "";
        row.textContent = `${at ? `${at}: ` : ""}${String(entry.note || "")}`;
        historyList.appendChild(row);
      });
    }

    const historyActions = document.createElement("div");
    historyActions.className = "issue-detail-actions";
    historyActions.appendChild(historyAddBtn);

    detailsBody.appendChild(historyField);
    detailsBody.appendChild(historyActions);
    detailsBody.appendChild(historyList);

    saveBtn.addEventListener("click", () => {
      updateIssueDetails(issue.id, {
        analysis: analysis.area.value.trim(),
        stepsToReproduce: repro.area.value.trim(),
        expected: expected.area.value.trim(),
        actual: actual.area.value.trim(),
        fixNotes: fixNotes.area.value.trim(),
        impact: impact.area.value.trim(),
      });
      renderAllPreviews();
    });

    historyAddBtn.addEventListener("click", () => {
      const note = historyInput.value.trim();
      if (!note) return;
      appendIssueHistory(issue.id, note);
      renderAllPreviews();
    });

    detailsWrap.appendChild(detailsBody);

    card.appendChild(head);
    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(statusSelect);
    card.appendChild(detailsWrap);
    list.appendChild(card);
  });

  target.appendChild(list);
}

function initIssueQuickForm() {
  const form = document.getElementById("issueQuickForm");
  const titleInput = document.getElementById("issueQuickTitle");
  const typeSelect = document.getElementById("issueQuickType");
  const projectSelect = document.getElementById("issueQuickProject");
  const severitySelect = document.getElementById("issueQuickSeverity");
  const filterSelect = document.getElementById("issueQuickFilter");
  const typeFilterSelect = document.getElementById("issueQuickTypeFilter");
  if (!form || !titleInput || !projectSelect || !severitySelect || !typeSelect) return;

  populateIssueProjectSelect();

  const refreshTypeUX = () => {
    const type = String(typeSelect.value || "bug").toLowerCase();
    if (type === "fr") {
      titleInput.placeholder = "What feature is requested? (example: add weekly trend chart)";
      severitySelect.options[0].textContent = "P1 Must Have";
      severitySelect.options[1].textContent = "P2 Should Have";
      severitySelect.options[2].textContent = "P3 Could Have";
      severitySelect.options[3].textContent = "P4 Nice To Have";
    } else {
      titleInput.placeholder = "What broke? (example: week view empty on reload)";
      severitySelect.options[0].textContent = "P1 Critical";
      severitySelect.options[1].textContent = "P2 High";
      severitySelect.options[2].textContent = "P3 Medium";
      severitySelect.options[3].textContent = "P4 Low";
    }
  };
  refreshTypeUX();
  typeSelect.addEventListener("change", refreshTypeUX);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = String(titleInput.value || "").trim();
    if (!title) return;

    const projectOption = projectSelect.selectedOptions && projectSelect.selectedOptions[0];
    const kind = String(typeSelect.value || "bug").toLowerCase() === "fr" ? "fr" : "bug";
    const issue = normalizeIssue({
      id: nextIssueId(
        projectSelect.value || "",
        projectOption ? projectOption.textContent : "General",
        kind
      ),
      kind,
      title,
      projectId: projectSelect.value || "",
      projectTitle: projectOption ? projectOption.textContent : "General / Unassigned",
      severity: severitySelect.value || "P2",
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const state = loadIssueTrackerState();
    state.issues.unshift(issue);
    saveIssueTrackerState(state);

    titleInput.value = "";
    titleInput.focus();
    renderAllPreviews();
  });

  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      renderAllPreviews();
    });
  }
  if (typeFilterSelect) {
    typeFilterSelect.addEventListener("change", () => {
      renderAllPreviews();
    });
  }
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
  const tasks = loadFromStorage("todoTasks", []);
  const activeTasks = Array.isArray(tasks) ? tasks.filter((task) => task && !task.done) : [];
  const sortedTasks = [...activeTasks].sort((a, b) => {
    const priorityDelta = comparePriority(a && a.priority, b && b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const dueA = a && a.due ? String(a.due) : "";
    const dueB = b && b.due ? String(b.due) : "";
    if (!dueA && !dueB) return String(a && a.title ? a.title : "").localeCompare(String(b && b.title ? b.title : ""));
    if (!dueA) return 1;
    if (!dueB) return -1;
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return String(a && a.title ? a.title : "").localeCompare(String(b && b.title ? b.title : ""));
  });
  const topTasks = sortedTasks.slice(0, 8);

  target.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "calendar-dash";
  wrap.innerHTML = `
    <div class="calendar-dash-meta">Top 8 tasks sorted by priority and due date.</div>
    <div class="calendar-dash-help">P1 is highest. Empty slots keep alignment stable.</div>
    <div class="calendar-dash-actions">
      <a class="calendar-dash-link" href="todo.html">Manage tasks</a>
      <a class="calendar-dash-link" href="calendar.html">Open full calendar</a>
    </div>
    <div class="calendar-patch-grid" role="list" aria-label="Top 8 prioritized calendar tasks"></div>
  `;
  target.appendChild(wrap);

  const board = wrap.querySelector(".calendar-patch-grid");
  if (!board) return;

  if (!topTasks.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-patch-note";
    empty.textContent = "No active tasks. Add tasks in To-Do to fill these slots.";
    board.appendChild(empty);
  }

  topTasks.forEach((task, index) => {
    const card = document.createElement("article");
    card.className = "calendar-patch-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", `Calendar slot ${index + 1}`);
    const due = readTaskDueParts(task.due);

    const head = document.createElement("div");
    head.className = "calendar-patch-head";

    const title = document.createElement("span");
    title.className = "calendar-patch-title";
    title.textContent = String(task && task.title ? task.title : "Untitled task");

    const pill = document.createElement("span");
    const priority = String(task && task.priority ? task.priority : "P4").toUpperCase();
    pill.className = `preview-pill ${priority.toLowerCase()}`;
    pill.textContent = priority;

    head.appendChild(title);
    head.appendChild(pill);

    const dueRow = document.createElement("div");
    dueRow.className = "calendar-patch-meta";
    dueRow.dataset.role = "due-meta";
    if (due.date && due.time) {
      dueRow.textContent = `Due ${formatShortDate(`${due.date}T${due.time}`, true)}`;
    } else if (due.date) {
      dueRow.textContent = `Due ${formatShortDate(due.date, false)}`;
    } else {
      dueRow.textContent = "No due date";
    }

    const slotRow = document.createElement("div");
    slotRow.className = "calendar-patch-rank";
    slotRow.textContent = `Slot ${index + 1} of 8`;

    card.appendChild(head);
    card.appendChild(dueRow);
    card.appendChild(slotRow);
    board.appendChild(card);
  });

  for (let i = topTasks.length; i < 8; i += 1) {
    const placeholder = document.createElement("article");
    placeholder.className = "calendar-patch-card calendar-patch-empty";
    placeholder.setAttribute("role", "listitem");
    placeholder.setAttribute("aria-label", `Calendar empty slot ${i + 1}`);
    placeholder.textContent = "Empty slot";
    board.appendChild(placeholder);
  }
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
      if (type === "issues") return renderIssuesPreview(target);
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
  initIssueQuickForm();
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
