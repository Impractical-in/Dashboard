(function initThemeToggle(globalScope) {
  const THEME_KEY = "dashboardThemeMode";
  const themeToggle = document.getElementById("themeToggle");
  if (!themeToggle) return;

  themeToggle.dataset.sharedTheme = "1";

  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored === "light" ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  }

  function writeTheme(mode) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (_) {}
  }

  function applyTheme(mode) {
    const light = mode === "light";
    document.body.classList.toggle("theme-light", light);
    themeToggle.setAttribute("aria-pressed", String(light));
    themeToggle.textContent = light ? "Theme: Light" : "Theme: Dark";
  }

  const initial = readTheme();
  applyTheme(initial);

  themeToggle.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-light") ? "dark" : "light";
    writeTheme(next);
    applyTheme(next);
    if (globalScope && typeof globalScope.dispatchEvent === "function") {
      try {
        const EventCtor = globalScope.CustomEvent;
        if (typeof EventCtor === "function") {
          globalScope.dispatchEvent(
            new EventCtor("dashboard-theme-change", { detail: { theme: next } })
          );
        }
      } catch (_) {}
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
