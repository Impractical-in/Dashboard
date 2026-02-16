(function versionBootstrap(rootFactory) {
  const versions = rootFactory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = versions;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.DASHBOARD_VERSIONS = versions;
  }
})(function createVersions() {
  return {
    dashboard: "0.3.0",
    agent: "v0.2",
  };
});
