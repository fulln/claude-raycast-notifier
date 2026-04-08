import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeEvent } from "../lib/state-store.mjs";

test("writeEvent sets current and appends recent history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ccrn-state-"));
  const filePath = join(dir, "state.json");

  await writeEvent(
    filePath,
    {
      type: "running",
      title: "Claude is working",
      message: "Running tests",
      severity: "info",
      timestamp: "2026-04-08T10:00:00.000Z",
    },
    5,
  );
  const state = await readState(filePath);

  assert.equal(state.current.type, "running");
  assert.equal(state.recent.length, 1);
});

test("writeEvent trims history to the configured max", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ccrn-trim-"));
  const filePath = join(dir, "state.json");

  for (const type of ["running", "needs_input", "failure"]) {
    await writeEvent(
      filePath,
      {
        type,
        title: type,
        message: type,
        severity: "info",
        timestamp: new Date().toISOString(),
      },
      2,
    );
  }

  const state = await readState(filePath);
  assert.equal(state.recent.length, 2);
});
