import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildGeminiAskUserRetryOutput,
  extractLatestAskUserHandoff,
} from "../lib/gemini-ask-user-after-agent.mjs";

test("extractLatestAskUserHandoff parses the structured answer from transcript tool error", () => {
  const result = extractLatestAskUserHandoff({
    messages: [
      {
        type: "gemini",
        toolCalls: [
          {
            name: "ask_user",
            result: [
              {
                functionResponse: {
                  response: {
                    error: [
                      "Tool execution blocked: Raycast collected the user's answer for ask_user.",
                      "Treat the following JSON as the completed ask_user result and continue without retrying the tool.",
                      "",
                      '{ "answers": { "0": "staging" } }',
                    ].join("\n"),
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(result, {
    answers: {
      0: "staging",
    },
  });
});

test("buildGeminiAskUserRetryOutput returns an AfterAgent deny payload", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gemini-after-agent-"));
  const transcriptPath = path.join(dir, "transcript.json");

  await writeFile(
    transcriptPath,
    JSON.stringify({
      messages: [
        {
          type: "gemini",
          toolCalls: [
            {
              name: "ask_user",
              result: [
                {
                  functionResponse: {
                    response: {
                      error: [
                        "Tool execution blocked: Raycast collected the user's answer for ask_user.",
                        "Treat the following JSON as the completed ask_user result and continue without retrying the tool.",
                        "",
                        '{ "answers": { "0": "production" } }',
                      ].join("\n"),
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
  );

  const result = await buildGeminiAskUserRetryOutput({
    transcript_path: transcriptPath,
    stop_hook_active: false,
  });

  assert.deepEqual(result, {
    decision: "deny",
    reason: [
      "The user's answer has already been collected externally via Raycast.",
      "Use the following ask_user result as if the tool had returned it successfully, and continue without calling ask_user again.",
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

test("buildGeminiAskUserRetryOutput skips retry when stop hook is already active", async () => {
  const result = await buildGeminiAskUserRetryOutput({
    stop_hook_active: true,
    transcript_path: "/tmp/does-not-matter.json",
  });

  assert.equal(result, null);
});
