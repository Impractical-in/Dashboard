const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("version sync check passes", () => {
  const scriptPath = path.join(process.cwd(), "tools", "sync-version.mjs");
  const result = spawnSync(process.execPath, [scriptPath, "--check"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "version check failed");
});
