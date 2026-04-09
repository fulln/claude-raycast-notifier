#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const rootPackagePath = join(repoRoot, "package.json");
const changelogPath = join(repoRoot, "CHANGELOG.md");
const releasesDir = join(repoRoot, "releases");
const extensionDistDir = join(repoRoot, "raycast-extension", "dist");

const [, , requestedVersion = "patch", ...noteArgs] = process.argv;

async function main() {
  const rootPackage = await readJson(rootPackagePath);
  const currentVersion = rootPackage.version ?? "0.1.0";
  const nextVersion = resolveVersion(currentVersion, requestedVersion);
  const notes = noteArgs.join(" ").trim();

  if (nextVersion === currentVersion) {
    throw new Error(`Next version must be different from current version ${currentVersion}`);
  }

  rootPackage.version = nextVersion;

  await writeJson(rootPackagePath, rootPackage);

  try {
    await run("npm", ["test"], repoRoot);
    await run("npm", ["run", "lint:extension"], repoRoot);
    await run("npm", ["run", "build:extension"], repoRoot);
  } catch (error) {
    await writeJson(rootPackagePath, { ...rootPackage, version: currentVersion });
    throw error;
  }

  await mkdir(releasesDir, { recursive: true });

  const artifactName = `claude-raycast-notifier-v${nextVersion}.zip`;
  const artifactPath = join(releasesDir, artifactName);
  if (!existsSync(extensionDistDir)) {
    throw new Error("Expected raycast-extension/dist to exist after build");
  }

  await execFileAsync("rm", ["-f", artifactPath], { cwd: repoRoot });
  await execFileAsync("zip", ["-qr", artifactPath, "."], { cwd: extensionDistDir });

  const releaseNotes = await buildReleaseNotes(notes);
  await updateChangelog({
    version: nextVersion,
    previousVersion: currentVersion,
    notes: releaseNotes,
    artifactName,
  });

  console.log(`Released ${nextVersion}`);
  console.log(`Artifact: ${artifactPath}`);
}

async function run(command, args, cwd) {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd });
  if (stdout.trim()) process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
}

function resolveVersion(currentVersion, requested) {
  if (/^\d+\.\d+\.\d+$/.test(requested)) return requested;

  const [major, minor, patch] = currentVersion.split(".").map(Number);
  if ([major, minor, patch].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid current version: ${currentVersion}`);
  }

  if (requested === "major") return `${major + 1}.0.0`;
  if (requested === "minor") return `${major}.${minor + 1}.0`;
  if (requested === "patch") return `${major}.${minor}.${patch + 1}`;

  throw new Error(
    `Version argument must be major, minor, patch, or an explicit semver. Received: ${requested}`,
  );
}

async function buildReleaseNotes(notes) {
  if (notes) return [notes];

  const latestTag = await tryExec("git", ["describe", "--tags", "--abbrev=0"], repoRoot);
  const args = latestTag
    ? ["log", `${latestTag.trim()}..HEAD`, "--pretty=format:%s"]
    : ["log", "--pretty=format:%s"];
  const history = await tryExec("git", args, repoRoot);

  const items = history
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  return items.length > 0 ? items : ["Repository snapshot release"];
}

async function updateChangelog({
  version,
  previousVersion,
  notes,
  artifactName,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const previous = existsSync(changelogPath)
    ? await readFile(changelogPath, "utf8")
    : "# Changelog\n\nAll notable releases for this repository are recorded here.\n";

  const entry = [
    `## ${version} - ${today}`,
    "",
    `- Version bump from ${previousVersion} to ${version}`,
    ...notes.map((note) => `- ${note}`),
    `- Release artifact: \`releases/${artifactName}\``,
    "",
  ].join("\n");

  const content = previous.trimEnd();
  const divider = content.includes("\n\n") ? "\n\n" : "\n";
  await writeFile(changelogPath, `${content}${divider}${entry}\n`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function tryExec(command, args, cwd) {
  try {
    const { stdout } = await execFileAsync(command, args, { cwd });
    return stdout.trim();
  } catch {
    return "";
  }
}

await main();
