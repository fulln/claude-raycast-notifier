import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const {
  notifierPaths,
  ensureUserData,
  readSoundLibrary,
  readSoundMappings,
  writeSoundMappings,
  importSound,
  getInstallStatus,
} = await import("../lib/sound-config.mjs");

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "ccrn-snd-"));
}

// Shared fixture paths
const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

// ---------------------------------------------------------------------------
// notifierPaths
// ---------------------------------------------------------------------------

test("notifierPaths returns expected sub-paths under the given root", () => {
  const root = "/tmp/test-root";
  const paths = notifierPaths(root);

  assert.equal(paths.rootDir, root);
  assert.equal(paths.soundsDir, join(root, "sounds"));
  assert.equal(paths.stateFile, join(root, "state.json"));
  assert.equal(paths.libraryFile, join(root, "sound-library.json"));
  assert.equal(paths.mappingsFile, join(root, "sound-mappings.json"));
});

// ---------------------------------------------------------------------------
// ensureUserData — install / repair
// ---------------------------------------------------------------------------

test("ensureUserData creates directory structure on first run", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  await assert.doesNotReject(access(join(root, "sound-library.json")));
  await assert.doesNotReject(access(join(root, "sound-mappings.json")));
  await assert.doesNotReject(access(join(root, "sounds")));
});

test("ensureUserData seeds bundled sounds and default mappings", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  await assert.doesNotReject(access(join(root, "sounds", "focus-bell.wav")));

  const library = await readSoundLibrary(root);
  assert.ok(Array.isArray(library.sounds), "library.sounds should be an array");
  assert.ok(library.sounds.length > 0, "library should have at least one entry");
  assert.equal(library.sounds[0].kind, "bundled");

  const mappings = await readSoundMappings(root);
  for (const slot of ["needs_input", "failure", "done", "success", "running"]) {
    assert.ok(mappings.slots[slot] !== undefined, `mappings.slots should have slot '${slot}'`);
  }
  assert.equal(mappings.slots.needs_input.soundId, "claude-ready-to-work");
  assert.equal(mappings.slots.needs_input.enabled, true);
});

test("ensureUserData is idempotent — re-running does not overwrite existing mappings", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  // Mutate mappings
  const mappingsPath = join(root, "sound-mappings.json");
  const raw = JSON.parse(await readFile(mappingsPath, "utf8"));
  raw.slots.done.enabled = false;
  await writeFile(mappingsPath, JSON.stringify(raw, null, 2));

  // Re-run
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const after = JSON.parse(await readFile(mappingsPath, "utf8"));
  assert.equal(after.slots.done.enabled, false, "existing user mappings should not be overwritten");
});

test("ensureUserData returns { paths, library, mappings }", async () => {
  const root = tempRoot();
  const result = await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  assert.ok(result.paths?.soundsDir, "result.paths.soundsDir should be set");
  assert.ok(Array.isArray(result.library?.sounds), "result.library.sounds should be array");
  assert.ok(result.mappings?.slots?.needs_input, "result.mappings.slots.needs_input should exist");
  assert.deepEqual(result.mappings?.hooks, {});
});

// ---------------------------------------------------------------------------
// readSoundLibrary / readSoundMappings / writeSoundMappings
// ---------------------------------------------------------------------------

test("readSoundLibrary returns { version: 1, sounds: [] } when file is missing", async () => {
  const root = tempRoot();
  const library = await readSoundLibrary(root);
  assert.deepEqual(library, { version: 1, sounds: [] });
});

test("readSoundMappings returns versioned slots fallback when file is missing", async () => {
  const root = tempRoot();
  const mappings = await readSoundMappings(root);
  assert.equal(mappings.version, 2);
  for (const slot of ["needs_input", "failure", "done", "success", "running"]) {
    assert.ok(mappings.slots[slot] !== undefined, `missing slot ${slot}`);
    assert.equal(mappings.slots[slot].soundId, null);
    assert.equal(mappings.slots[slot].enabled, false);
  }
  assert.deepEqual(mappings.hooks, {});
});

test("writeSoundMappings persists and readSoundMappings retrieves", async () => {
  const root = tempRoot();
  const data = {
    version: 2,
    slots: { done: { soundId: "focus-bell", enabled: true } },
    hooks: { "claude:stop": { soundId: "bright-success", enabled: true } },
  };

  await writeSoundMappings(root, data);
  const result = await readSoundMappings(root);

  assert.deepEqual(result, data);
});

// ---------------------------------------------------------------------------
// importSound
// ---------------------------------------------------------------------------

test("importSound copies a custom file into the managed sound library", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const sourceFile = join(bundledSoundsDir, "bright-success.wav");
  const entry = await importSound(sourceFile, "My Custom Sound", { rootDir: root });

  assert.equal(entry.kind, "imported");
  assert.equal(entry.label, "My Custom Sound");
  assert.ok(entry.id.startsWith("imported-"), "id should have imported- prefix");
  assert.ok(entry.filename, "entry should have a filename");
  assert.equal(entry.originalName, "bright-success.wav");

  await assert.doesNotReject(access(join(root, "sounds", entry.filename)));
});

test("importSound records entry in sound-library.json", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const sourceFile = join(bundledSoundsDir, "soft-alert.wav");
  const entry = await importSound(sourceFile, "Imported Alert", { rootDir: root });

  const library = await readSoundLibrary(root);
  assert.equal(library.sounds.at(-1).label, "Imported Alert");
  assert.ok(library.sounds.find((e) => e.id === entry.id), "entry should appear in library.sounds");
});

// ---------------------------------------------------------------------------
// getInstallStatus
// ---------------------------------------------------------------------------

test("getInstallStatus reports unhealthy when root is missing", async () => {
  const root = join(tempRoot(), "nonexistent-subdir");
  const status = await getInstallStatus(root);
  assert.equal(status.healthy, false);
  assert.ok(status.missing.length > 0, "should report missing paths");
  assert.equal(status.rootDir, root);
});

test("getInstallStatus reports healthy after ensureUserData", async () => {
  const root = tempRoot();
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const status = await getInstallStatus(root);
  assert.equal(status.healthy, true);
  assert.deepEqual(status.missing, []);
});
