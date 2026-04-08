import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

// Import the module under test — will throw if missing (intentional for TDD)
const {
  notifierPaths,
  ensureUserData,
  readSoundLibrary,
  readSoundMappings,
  writeSoundMappings,
  importSound,
  getInstallStatus,
} = await import("../lib/sound-config.mjs");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "ccrn-snd-"));
}

// ---------------------------------------------------------------------------
// notifierPaths
// ---------------------------------------------------------------------------

test("notifierPaths returns expected sub-paths under the given root", () => {
  const root = "/tmp/test-root";
  const paths = notifierPaths(root);

  assert.equal(paths.root, root);
  assert.equal(paths.soundsDir, join(root, "sounds"));
  assert.equal(paths.soundLibrary, join(root, "sound-library.json"));
  assert.equal(paths.soundMappings, join(root, "sound-mappings.json"));
});

// ---------------------------------------------------------------------------
// ensureUserData — install / repair
// ---------------------------------------------------------------------------

test("ensureUserData creates directory structure on first run", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  // sound library JSON exists
  await assert.doesNotReject(
    access(join(root, "sound-library.json")),
    "sound-library.json should exist",
  );

  // sound mappings JSON exists
  await assert.doesNotReject(
    access(join(root, "sound-mappings.json")),
    "sound-mappings.json should exist",
  );

  // sounds directory exists
  await assert.doesNotReject(
    access(join(root, "sounds")),
    "sounds/ directory should exist",
  );
});

test("ensureUserData seeds bundled sounds into the sounds directory", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  // at least one bundled wav copied
  await assert.doesNotReject(
    access(join(root, "sounds", "focus-bell.wav")),
    "focus-bell.wav should be copied",
  );
});

test("ensureUserData seeds default mappings from manifest", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const mappingsRaw = await readFile(join(root, "sound-mappings.json"), "utf8");
  const mappings = JSON.parse(mappingsRaw);

  // must contain the fixed slot set
  for (const slot of ["needs_input", "failure", "done", "success", "running"]) {
    assert.ok(Object.hasOwn(mappings, slot), `mappings should have slot '${slot}'`);
  }
});

test("ensureUserData seeds sound library with bundled entries", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const libraryRaw = await readFile(join(root, "sound-library.json"), "utf8");
  const library = JSON.parse(libraryRaw);

  assert.ok(Array.isArray(library), "library should be an array");
  assert.ok(library.length > 0, "library should have at least one entry");
  assert.ok(
    library.every((e) => e.id && e.filename),
    "each library entry must have id and filename",
  );
});

test("ensureUserData is idempotent — re-running does not overwrite existing mappings", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");

  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  // mutate mappings
  const mappingsPath = join(root, "sound-mappings.json");
  const mappings = JSON.parse(await readFile(mappingsPath, "utf8"));
  mappings.done.enabled = false;
  await (await import("node:fs/promises")).writeFile(
    mappingsPath,
    JSON.stringify(mappings, null, 2),
  );

  // re-run ensureUserData
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const after = JSON.parse(await readFile(mappingsPath, "utf8"));
  assert.equal(after.done.enabled, false, "existing user mappings should not be overwritten");
});

// ---------------------------------------------------------------------------
// readSoundLibrary / readSoundMappings / writeSoundMappings
// ---------------------------------------------------------------------------

test("readSoundLibrary returns empty array when file is missing", async () => {
  const root = tempRoot();
  const library = await readSoundLibrary(root);
  assert.deepEqual(library, []);
});

test("readSoundMappings returns empty object when file is missing", async () => {
  const root = tempRoot();
  const mappings = await readSoundMappings(root);
  assert.deepEqual(mappings, {});
});

test("writeSoundMappings persists and readSoundMappings retrieves", async () => {
  const root = tempRoot();
  const data = { done: { soundId: "focus-bell", enabled: true } };

  await writeSoundMappings(root, data);
  const result = await readSoundMappings(root);

  assert.deepEqual(result, data);
});

// ---------------------------------------------------------------------------
// importSound
// ---------------------------------------------------------------------------

test("importSound copies a file into the managed sounds directory", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  // use one of the bundled wavs as the "custom" source
  const sourceFile = join(bundledSoundsDir, "bright-success.wav");
  const entry = await importSound(sourceFile, "My Custom Sound", { rootDir: root });

  assert.ok(entry.id, "entry should have an id");
  assert.equal(entry.label, "My Custom Sound");
  assert.equal(entry.kind, "custom");
  assert.ok(entry.filename, "entry should have a filename");

  // file should exist in the managed sounds directory
  await assert.doesNotReject(
    access(join(root, "sounds", entry.filename)),
    "imported file should exist in sounds/",
  );
});

test("importSound records entry in sound-library.json", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const sourceFile = join(bundledSoundsDir, "soft-alert.wav");
  const entry = await importSound(sourceFile, "Imported Alert", { rootDir: root });

  const library = await readSoundLibrary(root);
  const found = library.find((e) => e.id === entry.id);
  assert.ok(found, "imported entry should appear in sound-library.json");
});

// ---------------------------------------------------------------------------
// getInstallStatus
// ---------------------------------------------------------------------------

test("getInstallStatus reports not installed when root is missing", async () => {
  const root = join(tempRoot(), "nonexistent-subdir");
  const status = await getInstallStatus(root);
  assert.equal(status.installed, false);
});

test("getInstallStatus reports installed after ensureUserData", async () => {
  const root = tempRoot();

  const bundledSoundsDir = join(repoRoot, "raycast-extension", "assets", "sounds");
  const manifestFile = join(repoRoot, "config", "default-sound-pack.json");
  await ensureUserData({ rootDir: root, manifestFile, bundledSoundsDir });

  const status = await getInstallStatus(root);
  assert.equal(status.installed, true);
  assert.ok(status.soundCount >= 0);
  assert.ok(status.mappingCount >= 0);
});
