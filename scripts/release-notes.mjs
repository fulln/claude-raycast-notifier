#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [, , beforeSha, currentSha, tag] = process.argv;

if (!currentSha || !tag) {
  throw new Error("Usage: node scripts/release-notes.mjs <beforeSha> <currentSha> <tag>");
}

const lines = [];
lines.push(`# ${tag}`);
lines.push("");
lines.push(`- Commit: \`${currentSha}\``);
lines.push(`- Generated from push to \`main\``);
lines.push("");
lines.push("## Changes");
lines.push("");

const hasBefore = beforeSha && !/^0+$/.test(beforeSha);
const args = hasBefore
  ? ["log", `${beforeSha}..${currentSha}`, "--pretty=format:- %s"]
  : ["log", "-1", "--pretty=format:- %s", currentSha];

const { stdout } = await execFileAsync("git", args);
const commits = stdout.trim();
lines.push(commits || "- Repository update");

process.stdout.write(lines.join("\n") + "\n");
