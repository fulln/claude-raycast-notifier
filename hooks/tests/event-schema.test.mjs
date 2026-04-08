import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent } from "../lib/event-schema.mjs";

test("normalizeEvent maps needs_input payloads", () => {
  const event = normalizeEvent(
    {
      type: "needs_input",
      title: "Claude needs your input",
      message: "Approve the command in Claude Code",
    },
    {},
  );

  assert.equal(event.type, "needs_input");
  assert.equal(event.severity, "warning");
  assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("normalizeEvent maps failure payloads to error severity", () => {
  const event = normalizeEvent({ type: "failure", title: "Tests failed" }, {});
  assert.equal(event.severity, "error");
});
