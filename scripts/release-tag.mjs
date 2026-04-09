#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

async function main() {
  const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  const version = pkg.version;

  if (!version) {
    throw new Error("package.json is missing a version field");
  }

  const tag = `v${version}`;
  const existing = await tryExec("git", ["tag", "--list", tag]);
  if (existing.trim() === tag) {
    throw new Error(`Tag ${tag} already exists`);
  }

  await run("git", ["tag", tag]);
  console.log(`Created tag ${tag}`);
  console.log(`Push it with: git push origin ${tag}`);
}

async function run(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd: repoRoot });
  if (stdout.trim()) process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);
}

async function tryExec(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { cwd: repoRoot });
    return stdout.trim();
  } catch {
    return "";
  }
}

await main();
