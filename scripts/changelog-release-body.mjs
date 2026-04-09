#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const [, , rawVersion] = process.argv;

if (!rawVersion) {
  throw new Error("Usage: node scripts/changelog-release-body.mjs <version>");
}

const version = rawVersion.replace(/^v/, "");
const changelog = await readFile(join(repoRoot, "CHANGELOG.md"), "utf8");
const lines = changelog.split("\n");
const headerPrefix = `## ${version} - `;
const startIndex = lines.findIndex((line) => line.startsWith(headerPrefix));

if (startIndex === -1) {
  throw new Error(`No changelog entry found for version ${version}`);
}

const bodyLines = [];
for (let index = startIndex; index < lines.length; index += 1) {
  const line = lines[index];
  if (index > startIndex && line.startsWith("## ")) break;
  bodyLines.push(line);
}

process.stdout.write(bodyLines.join("\n").trimEnd() + "\n");
