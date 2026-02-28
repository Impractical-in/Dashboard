(function initHeaderVersion(globalScope) {
  const dashboardVersion =
    globalScope &&
    globalScope.DASHBOARD_VERSIONS &&
    typeof globalScope.DASHBOARD_VERSIONS.dashboard === "string"
      ? globalScope.DASHBOARD_VERSIONS.dashboard
      : "";
  const versionValue = dashboardVersion ? `v${dashboardVersion}` : "v0.0.0";

  const headerVersionEl = document.getElementById("headerVersion");
  if (headerVersionEl) headerVersionEl.textContent = versionValue;
})(typeof window !== "undefined" ? window : globalThis);
