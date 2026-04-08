import test from "node:test";
import assert from "node:assert/strict";
import { isActionableEvent, normalizeEvent } from "../lib/event-schema.mjs";

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
  assert.equal(event.action, null);
  assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("normalizeEvent maps failure payloads to error severity", () => {
  const event = normalizeEvent({ type: "failure", title: "Tests failed" }, {});
  assert.equal(event.severity, "error");
  assert.equal(event.action, null);
});

test("normalizeEvent preserves actionable choice metadata", () => {
  const event = normalizeEvent(
    {
      type: "needs_input",
      title: "Pick one",
      message: "Choose how to proceed",
      prompt: "Select an option",
      options: [
        { label: "Approve", value: "approve" },
        { label: "Decline", value: "decline" },
      ],
    },
    { CLAUDE_HOOK_EVENT_NAME: "Elicitation" },
  );

  assert.deepEqual(event.action, {
    kind: "choice",
    prompt: "Select an option",
    options: [
      { id: "approve", label: "Approve", detail: undefined },
      { id: "decline", label: "Decline", detail: undefined },
    ],
    placeholder: undefined,
    submitHint: undefined,
  });
  assert.equal(event.hookEventName, "Elicitation");
  assert.equal(isActionableEvent(event), true);
});

test("plain done notifications are not actionable", () => {
  const event = normalizeEvent(
    { type: "done", title: "Claude finished the task" },
    { CLAUDE_HOOK_EVENT_NAME: "Stop" },
  );

  assert.equal(isActionableEvent(event), false);
});

test("normalizeEvent marks elicitation payloads as needs_input with a needs_input sound slot", () => {
  const event = normalizeEvent(
    {
      type: "needs_input",
      title: "Pick one",
      message: "Choose how to proceed",
      prompt: "Select an option",
      options: [
        { label: "Approve", value: "approve" },
        { label: "Decline", value: "decline" },
      ],
    },
    { CLAUDE_HOOK_EVENT_NAME: "Elicitation" },
  );

  assert.equal(event.soundSlot, "needs_input");
  assert.equal(event.action?.kind, "choice");
  assert.equal(isActionableEvent(event), true);
});

test("normalizeEvent maps failure payloads to the failure sound slot", () => {
  const event = normalizeEvent({ type: "failure", title: "Tests failed" }, {});

  assert.equal(event.soundSlot, "failure");
  assert.equal(event.severity, "error");
});
