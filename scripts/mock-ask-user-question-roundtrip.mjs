import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runClaudeAskUserQuestionBridge } from "../hooks/lib/claude-ask-user-question-bridge.mjs";
import { writeQuestionResponse } from "../hooks/lib/ask-user-question-response.mjs";

const rootDir = await mkdtemp(
  path.join(tmpdir(), "claude-raycast-notifier-roundtrip-"),
);

const result = await runClaudeAskUserQuestionBridge({
  rootDir,
  timeoutMs: 1000,
  pollMs: 20,
  raw: {
    tool_name: "AskUserQuestion",
    session_id: "demo-session",
    tool_use_id: "demo-tool-use",
    tool_input: {
      prompt: "Choose a deployment target",
      questions: [
        {
          question: "Where should Claude deploy?",
          choices: [
            { label: "staging", description: "Safer preview environment" },
            { label: "production", description: "Live user traffic" },
          ],
        },
      ],
    },
  },
  openRaycast: async (payload) => {
    await writeQuestionResponse(rootDir, payload.requestId, {
      requestId: payload.requestId,
      status: "submitted",
      submittedAt: new Date().toISOString(),
      answers: {
        "Where should Claude deploy?": "staging",
      },
    });
  },
});

process.stdout.write(
  JSON.stringify(
    {
      demo: "ask-user-question-roundtrip",
      rootDir,
      result,
    },
    null,
    2,
  ) + "\n",
);
