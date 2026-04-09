import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import { ensureUserData, readSoundMappings } from "../lib/sound-config.mjs";
import { resolveSoundForEvent } from "../lib/playback.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "ccrn-playback-"));
}

test("resolveSoundForEvent returns an existing file for an enabled slot", async () => {
  const rootDir = tempRoot();
  await ensureUserData({ rootDir, manifestFile, bundledSoundsDir });

  const playback = await resolveSoundForEvent(
    { type: "needs_input", soundSlot: "needs_input" },
    { rootDir },
  );

  assert.equal(playback.reason, null);
  assert.equal(playback.soundId, "focus-bell");
  assert.equal(playback.slot, "needs_input");
  assert.match(playback.filePath, /focus-bell\.wav$/);
});

test("resolveSoundForEvent returns null filePath for a disabled slot", async () => {
  const rootDir = tempRoot();
  await ensureUserData({ rootDir, manifestFile, bundledSoundsDir });

  const mappings = await readSoundMappings(rootDir);
  mappings.slots.failure.enabled = false;
  await writeFile(
    join(rootDir, "sound-mappings.json"),
    JSON.stringify(mappings, null, 2),
  );

  const playback = await resolveSoundForEvent(
    { type: "failure", soundSlot: "failure" },
    { rootDir },
  );

  assert.equal(playback.filePath, null);
  assert.equal(playback.reason, "disabled");
  assert.equal(playback.soundId, mappings.slots.failure.soundId);
  assert.equal(playback.slot, "failure");
});

test("resolveSoundForEvent prefers a hook-specific mapping over the slot fallback", async () => {
  const rootDir = tempRoot();
  await ensureUserData({ rootDir, manifestFile, bundledSoundsDir });

  const mappings = await readSoundMappings(rootDir);
  mappings.hooks = {
    "claude:stop": {
      soundId: "bright-success",
      enabled: true,
    },
  };
  await writeFile(
    join(rootDir, "sound-mappings.json"),
    JSON.stringify(mappings, null, 2),
  );

  const playback = await resolveSoundForEvent(
    {
      type: "done",
      soundSlot: "done",
      hookKey: "claude:stop",
    },
    { rootDir },
  );

  assert.equal(playback.reason, null);
  assert.equal(playback.soundId, "bright-success");
  assert.equal(playback.hookKey, "claude:stop");
  assert.match(playback.filePath, /bright-success\.wav$/);
});
