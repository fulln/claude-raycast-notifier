#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth() + 1;
const prefix = `v${year}.${month}.`;

const { stdout } = await execFileAsync("git", ["tag", "--list", `${prefix}*`]);
const numbers = stdout
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((tag) => Number(tag.slice(prefix.length)))
  .filter((value) => Number.isInteger(value) && value > 0);

const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
process.stdout.write(`${year}.${month}.${next}\n`);
