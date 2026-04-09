import test from "node:test";
import assert from "node:assert/strict";
import {
  isActionableEvent,
  normalizeEvent,
  shouldOpenRaycast,
  shouldNotifyEvent,
} from "../lib/event-schema.mjs";

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
  assert.equal(event.source, "claude");
  assert.equal(event.hookKey, "claude:needs_input");
  assert.equal(event.severity, "warning");
  assert.equal(event.action, null);
  assert.match(event.timestamp, /^\d{4}-\d{2}-\d{2}T/);
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
  assert.equal(event.hookKey, "claude:elicitation");
  assert.equal(isActionableEvent(event), true);
  assert.equal(shouldNotifyEvent(event), true);
});

test("done notifications are not actionable but still notify", () => {
  const event = normalizeEvent(
    { type: "done", title: "Claude finished the task" },
    { CLAUDE_HOOK_EVENT_NAME: "Stop" },
  );

  assert.equal(isActionableEvent(event), false);
  assert.equal(event.hookKey, "claude:stop");
  assert.equal(shouldNotifyEvent(event), true);
  assert.equal(shouldOpenRaycast(event), false);
});

test("normalizeEvent supports explicit gemini source and returnUrl", () => {
  const event = normalizeEvent(
    {
      source: "gemini",
      type: "done",
      returnUrl: "gemini://",
      title: "Gemini finished the task",
    },
    { AI_NOTIFIER_HOOK: "done" },
  );

  assert.equal(event.source, "gemini");
  assert.equal(event.hookKey, "gemini:done");
  assert.equal(event.returnUrl, "gemini://");
  assert.equal(shouldNotifyEvent(event), true);
  assert.equal(shouldOpenRaycast(event), false);
});

test("normalizeEvent maps Copilot session completion to done", () => {
  const event = normalizeEvent(
    {
      source: "copilot",
      hook_event_name: "sessionEnd",
      reason: "complete",
    },
    {},
  );

  assert.equal(event.source, "copilot");
  assert.equal(event.type, "done");
  assert.equal(event.hookKey, "copilot:sessionend");
  assert.equal(event.returnUrl, null);
  assert.equal(shouldNotifyEvent(event), true);
});

test("normalizeEvent maps failure payloads to the failure sound slot", () => {
  const event = normalizeEvent({ type: "failure", title: "Tests failed" }, {});

  assert.equal(event.soundSlot, "failure");
  assert.equal(event.severity, "error");
  assert.equal(shouldNotifyEvent(event), false);
  assert.equal(shouldOpenRaycast(event), false);
});

test("choice events notify without forcing Raycast to open", () => {
  const event = normalizeEvent(
    {
      type: "needs_input",
      options: [{ label: "Approve", value: "approve" }],
    },
    { CLAUDE_HOOK_EVENT_NAME: "Elicitation" },
  );

  assert.equal(shouldNotifyEvent(event), true);
  assert.equal(shouldOpenRaycast(event), false);
});
