import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../", import.meta.url);

test("generate-default-sounds converts file URLs with fileURLToPath", async () => {
  const source = await readFile(
    new URL("scripts/generate-default-sounds.mjs", repoRoot),
    "utf8",
  );

  assert.match(source, /fileURLToPath\(/);
  assert.doesNotMatch(source, /dirname\(fileUrl\.pathname\)/);
});

test("mock:success reuses the supported done event", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", repoRoot), "utf8"));

  assert.equal(
    packageJson.scripts["mock:success"],
    "node hooks/mock-event.mjs done | node hooks/claude-event-bridge.mjs",
  );
});
