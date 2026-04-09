import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

test("bootstrap exits early on native Windows mode", async () => {
  await assert.rejects(
    execFileAsync("bash", ["./scripts/bootstrap.sh"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        AI_HOOK_NOTIFIER_PLATFORM_MODE: "windows-unsupported",
      },
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Native Windows is not supported by this installer\./);
      return true;
    },
  );
});

test("install hook-only mode writes merged settings and skips Raycast startup", async () => {
  const homeDir = await mkdtemp(path.join(tmpdir(), "ai-hook-notifier-test-"));
  const { stdout } = await execFileAsync("bash", ["./scripts/install.sh"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: homeDir,
      AI_HOOK_NOTIFIER_PLATFORM_MODE: "hook-only",
    },
  });

  assert.match(stdout, /Hook-only mode is active\./);
  assert.match(stdout, /Claude and Gemini hooks were installed\./);
  assert.doesNotMatch(stdout, /Started Raycast develop session in background/);

  const claudeSettings = JSON.parse(
    await readFile(path.join(homeDir, ".claude/settings.json"), "utf8"),
  );
  const geminiSettings = JSON.parse(
    await readFile(path.join(homeDir, ".gemini/settings.json"), "utf8"),
  );

  assert.ok(claudeSettings.hooks.Stop);
  assert.ok(claudeSettings.hooks.Elicitation);
  assert.ok(geminiSettings.hooks.Notification);
  assert.ok(geminiSettings.hooks.AfterAgent);
});
