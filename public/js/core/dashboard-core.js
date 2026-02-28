(function initDashboardCore(globalScope) {
  if (!globalScope) return;

  const STORAGE_KEYS = {
    projects: "dashboardEntries",
    tasks: "todoTasks",
    hobbies: "hobbyTracker",
  };

  function parseDateOnly(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseDateTime(value) {
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

  function parseTags(value) {
    return String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function comparePriority(a, b) {
    const order = { P1: 1, P2: 2, P3: 3, P4: 4 };
    return (order[a] || 9) - (order[b] || 9);
  }

  function sortTasks(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
      const dueA = a && a.due ? a.due : "";
      const dueB = b && b.due ? b.due : "";
      if (dueA === dueB) {
        const priorityCompare = comparePriority(a && a.priority, b && b.priority);
        if (priorityCompare !== 0) return priorityCompare;
        return String((a && a.title) || "").localeCompare(String((b && b.title) || ""));
      }
      if (!dueA) return 1;
      if (!dueB) return -1;
      return dueA.localeCompare(dueB);
    });
  }

  function normalizeChecklist(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (typeof item === "string") {
          const text = item.trim();
          if (!text) return null;
          return { id: globalScope.generateId(), text, done: false, completedAt: "" };
        }
        if (!item || typeof item !== "object") return null;
        const text = String(item.text || "").trim();
        if (!text) return null;
        return {
          id: item.id || globalScope.generateId(),
          text,
          done: Boolean(item.done),
          completedAt: item.completedAt || "",
        };
      })
      .filter(Boolean);
  }

  function parseChecklistInput(value, existing) {
    const previous = new Map();
    normalizeChecklist(existing).forEach((item) => previous.set(item.text.toLowerCase(), item));
    const lines = String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const seen = new Set();
    return lines
      .filter((line) => {
        const key = line.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((line) => {
        const key = line.toLowerCase();
        const prior = previous.get(key);
        if (prior) return { ...prior, text: line };
        return { id: globalScope.generateId(), text: line, done: false, completedAt: "" };
      });
  }

  function checklistToText(list) {
    return normalizeChecklist(list)
      .map((item) => item.text)
      .join("\n");
  }

  function normalizeEntries(items, saveFn) {
    let migrated = false;
    const normalized = (Array.isArray(items) ? items : []).map((entry) => {
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
              const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
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
      if (!Array.isArray(copy.history)) {
        copy.history = [];
        migrated = true;
      }
      if (
        typeof copy.calendarTime !== "string" ||
        !/^([01]\d|2[0-3]):([0-5]\d)$/.test(copy.calendarTime)
      ) {
        copy.calendarTime = "09:00";
        migrated = true;
      }
      if (!Number.isFinite(Number(copy.calendarDurationMinutes))) {
        copy.calendarDurationMinutes = 60;
        migrated = true;
      }
      if (!copy.createdAt) {
        copy.createdAt = new Date().toISOString();
        migrated = true;
      }
      if (!copy.updatedAt) {
        copy.updatedAt = copy.createdAt;
        migrated = true;
      }
      return copy;
    });
    if (migrated && typeof saveFn === "function") saveFn(normalized);
    return normalized;
  }

  function sortEntries(items) {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
      const dateA = a.startDate || a.endDate || a.createdAt;
      const dateB = b.startDate || b.endDate || b.createdAt;
      if (dateA === dateB) return String(a.title || "").localeCompare(String(b.title || ""));
      return String(dateB || "").localeCompare(String(dateA || ""));
    });
  }

  function formatDuration(start, end) {
    const hours = Math.max(0, (end - start) / (60 * 60 * 1000));
    return `${Math.round(hours * 100) / 100}h`;
  }

  function loadLinkedItems(loadFn, overrides) {
    const read = typeof loadFn === "function" ? loadFn : () => [];
    const keys = {
      ...STORAGE_KEYS,
      ...(overrides && typeof overrides === "object" ? overrides : {}),
    };
    const projects = read(keys.projects, []);
    const tasks = read(keys.tasks, []);
    const hobbiesData = read(keys.hobbies, { hobbies: [] });
    const hobbies = Array.isArray(hobbiesData && hobbiesData.hobbies) ? hobbiesData.hobbies : [];

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

    return [...mappedProjects, ...mappedTasks, ...mappedHobbies];
  }

  globalScope.DashboardCore = {
    date: {
      parseDateOnly,
      parseDateTime,
      dayIndex,
      isWithinDateRange,
    },
    tags: {
      parse: parseTags,
    },
    tasks: {
      comparePriority,
      sortTasks,
      normalizeChecklist,
      parseChecklistInput,
      checklistToText,
    },
    projects: {
      normalizeEntries,
      sortEntries,
      formatDuration,
    },
    links: {
      loadLinkedItems,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
