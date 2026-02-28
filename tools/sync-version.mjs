import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const versionPath = path.join(root, "public", "js", "version.js");
const checkOnly = process.argv.includes("--check");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readDashboardVersion(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/dashboard:\s*"([^"]+)"/);
  return match ? String(match[1]) : null;
}

function writeDashboardVersion(filePath, version) {
  const source = fs.readFileSync(filePath, "utf8");
  const next = source.replace(/dashboard:\s*"([^"]+)"/, `dashboard: "${version}"`);
  fs.writeFileSync(filePath, next, "utf8");
}

const pkg = readJson(packagePath);
const packageVersion = String(pkg.version || "").trim();
if (!packageVersion) {
  console.error("package.json version is missing.");
  process.exit(1);
}

const dashboardVersion = readDashboardVersion(versionPath);
if (!dashboardVersion) {
  console.error("public/js/version.js dashboard version was not found.");
  process.exit(1);
}

if (dashboardVersion === packageVersion) {
  console.log(`Version ok: ${packageVersion}`);
  process.exit(0);
}

if (checkOnly) {
  console.error(
    `Version mismatch: package.json=${packageVersion}, public/js/version.js=${dashboardVersion}`
  );
  process.exit(1);
}

writeDashboardVersion(versionPath, packageVersion);
console.log(`Synced dashboard version to ${packageVersion}`);
