import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const changelogPath = path.join(root, "docs", "changelog.md");
const mode = (process.argv[2] || "patch").toLowerCase();

if (!["patch", "minor", "major"].includes(mode)) {
  console.error("Usage: node tools/bump-version.mjs <patch|minor|major>");
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function bumpSemver(version, bumpMode) {
  const match = String(version || "")
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semver in package.json: "${version}"`);
  }
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (bumpMode === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpMode === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function prependChangelogVersion(version) {
  const source = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : "# Changelog\n\n";
  const heading = `## v${version}`;
  if (source.includes(heading)) return;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;
  const block = `${heading} (${date})\n\n- Version bump and release scaffold.\n\n`;

  const anchor = "# Changelog\n\n";
  if (source.startsWith(anchor)) {
    fs.writeFileSync(changelogPath, `${anchor}${block}${source.slice(anchor.length)}`, "utf8");
    return;
  }
  fs.writeFileSync(changelogPath, `# Changelog\n\n${block}${source}`, "utf8");
}

function runSyncScript() {
  const scriptPath = path.join(root, "tools", "sync-version.mjs");
  const res = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });
  if (res.status !== 0) {
    process.stderr.write(res.stderr || res.stdout || "Failed to sync version file.\n");
    process.exit(res.status || 1);
  }
}

const pkg = readJson(packagePath);
const previous = String(pkg.version || "").trim();
const next = bumpSemver(previous, mode);
pkg.version = next;
writeJson(packagePath, pkg);
runSyncScript();
prependChangelogVersion(next);

console.log(`Bumped version: ${previous} -> ${next}`);
