import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runGeminiAskUserBridge } from "../lib/gemini-ask-user-bridge.mjs";
import { writeQuestionResponse } from "../lib/ask-user-question-response.mjs";

test("runGeminiAskUserBridge returns deny reason with indexed ask_user answers", async () => {
  const rootDir = await mkdtemp(
    path.join(tmpdir(), "gemini-raycast-question-"),
  );
  let capturedPayload = null;

  const result = await runGeminiAskUserBridge({
    rootDir,
    timeoutMs: 1000,
    pollMs: 10,
    raw: {
      tool_name: "ask_user",
      session_id: "gemini-session",
      tool_use_id: "tool-1",
      tool_input: {
        prompt: "Where should Gemini deploy?",
        title: "Deployment Target",
        type: "choice",
        options: ["staging", "production"],
      },
    },
    openRaycast: async (payload) => {
      capturedPayload = payload;
      await writeQuestionResponse(rootDir, payload.requestId, {
        requestId: payload.requestId,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        answers: {
          "Where should Gemini deploy?": "production",
        },
      });
    },
  });

  assert.equal(
    capturedPayload.questions[0].prompt,
    "Where should Gemini deploy?",
  );
  assert.deepEqual(result, {
    decision: "deny",
    reason: [
      "Raycast collected the user's answer for ask_user.",
      "Treat the following JSON as the completed ask_user result and continue without retrying the tool.",
      "",
      JSON.stringify(
        {
          answers: {
            0: "production",
          },
        },
        null,
        2,
      ),
    ].join("\n"),
  });
});

test("runGeminiAskUserBridge denies when Raycast response times out", async () => {
  const rootDir = await mkdtemp(
    path.join(tmpdir(), "gemini-raycast-question-"),
  );

  const result = await runGeminiAskUserBridge({
    rootDir,
    timeoutMs: 20,
    pollMs: 5,
    raw: {
      tool_name: "ask_user",
      session_id: "gemini-session",
      tool_use_id: "tool-2",
      tool_input: {
        prompt: "Where should Gemini deploy?",
        type: "text",
      },
    },
    openRaycast: async () => {},
  });

  assert.deepEqual(result, {
    decision: "deny",
    reason: "Timed out waiting for Raycast input",
  });
});
