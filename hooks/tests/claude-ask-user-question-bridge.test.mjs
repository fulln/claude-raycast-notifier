import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudeAskUserQuestionBridge } from "../lib/claude-ask-user-question-bridge.mjs";
import { writeQuestionResponse } from "../lib/ask-user-question-response.mjs";

test("runClaudeAskUserQuestionBridge returns updatedInput answers from Raycast response", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "claude-raycast-question-"));
  let capturedPayload = null;

  const result = await runClaudeAskUserQuestionBridge({
    rootDir,
    timeoutMs: 1000,
    pollMs: 10,
    raw: {
      tool_name: "AskUserQuestion",
      session_id: "session-1",
      tool_use_id: "tool-1",
      tool_input: {
        questions: [
          {
            question: "Which environment?",
            choices: ["dev", "prod"],
          },
        ],
      },
    },
    openRaycast: async (payload) => {
      capturedPayload = payload;
      await writeQuestionResponse(rootDir, payload.requestId, {
        requestId: payload.requestId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        answers: {
          "Which environment?": "prod",
        },
      });
    },
  });

  assert.equal(capturedPayload.questions[0].prompt, "Which environment?");
  assert.deepEqual(result, {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: {
        questions: [
          {
            question: "Which environment?",
            choices: ["dev", "prod"],
          },
        ],
        answers: {
          "Which environment?": "prod",
        },
      },
    },
  });
});

test("runClaudeAskUserQuestionBridge denies when Raycast response times out", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "claude-raycast-question-"));

  const result = await runClaudeAskUserQuestionBridge({
    rootDir,
    timeoutMs: 20,
    pollMs: 5,
    raw: {
      tool_name: "AskUserQuestion",
      session_id: "session-1",
      tool_use_id: "tool-2",
      tool_input: {
        questions: [
          {
            question: "Which environment?",
            choices: ["dev", "prod"],
          },
        ],
      },
    },
    openRaycast: async () => {},
  });

  assert.deepEqual(result, {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Timed out waiting for Raycast input",
    },
  });
});
