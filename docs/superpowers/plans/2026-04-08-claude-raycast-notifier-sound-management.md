# Claude Raycast Notifier Sound Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sound-first Claude Code hook manager that ships with a bundled default sound pack, plays mapped sounds for real hook events, and lets users inspect, preview, import, and remap sounds from Raycast.

**Architecture:** A Node.js bridge remains the runtime entrypoint for Claude hooks, but it now normalizes each event into a semantic `soundSlot`, ensures the local user data directory exists, resolves the mapped sound file, plays it with `afplay`, updates runtime state, and only foregrounds Raycast for actionable events. The Raycast extension reads the same local JSON files, exposes dedicated sound-management views, imports custom audio into the managed library, and surfaces install health plus current Claude state in the Menu Bar.

**Tech Stack:** Node.js ESM, built-in `node:test`, Raycast API + TypeScript, macOS `afplay`, macOS `open`, macOS `osascript`

---

## File Map

### Root files
- Modify: `package.json` — add sound-pack generation and sound-aware mock scripts
- Create: `scripts/generate-default-sounds.mjs` — deterministically generate the bundled `.wav` files from a checked-in manifest
- Create: `config/default-sound-pack.json` — manifest for bundled sounds plus default slot mappings
- Modify: `config/claude-hooks.example.json` — show bridge wiring for passive and actionable Claude hook families

### Bundled asset files
- Create: `raycast-extension/assets/sounds/focus-bell.wav` — bundled default for `needs_input`
- Create: `raycast-extension/assets/sounds/soft-alert.wav` — bundled default for `failure`
- Create: `raycast-extension/assets/sounds/gentle-finish.wav` — bundled default for `done`
- Create: `raycast-extension/assets/sounds/bright-success.wav` — bundled optional sound for `success`

### Hook bridge files
- Modify: `hooks/lib/event-schema.mjs` — add `soundSlot` derivation to normalized events
- Modify: `hooks/lib/state-store.mjs` — persist playback metadata alongside current/recent runtime state
- Create: `hooks/lib/sound-config.mjs` — initialize `~/.claude-raycast-notifier`, copy bundled assets, read/write library and mappings, import custom sounds
- Create: `hooks/lib/playback.mjs` — resolve mapped sounds and play them with `afplay`
- Modify: `hooks/claude-event-bridge.mjs` — replace `say`-based voice logic with mapped sound playback and sound-aware state writes
- Modify: `hooks/mock-event.mjs` — emit sound-aware passive and actionable events for local verification
- Modify: `hooks/tests/event-schema.test.mjs` — cover `soundSlot`
- Modify: `hooks/tests/state-store.test.mjs` — cover playback metadata writes
- Create: `hooks/tests/sound-config.test.mjs` — cover install/repair and custom import behavior
- Create: `hooks/tests/playback.test.mjs` — cover mapping resolution and disabled/missing sound paths
- Delete: `hooks/lib/voice.mjs` — obsolete after replacing spoken voice with mapped audio playback
- Delete: `hooks/tests/voice.test.mjs` — obsolete after removing `say`-based playback

### Raycast extension files
- Modify: `raycast-extension/package.json` — rename the extension around sound management, remove obsolete voice preference, add sound-management commands
- Modify: `raycast-extension/src/lib/event.ts` — add `soundSlot` to the shared event type
- Modify: `raycast-extension/src/lib/state.ts` — read sound metadata from `state.json`
- Create: `raycast-extension/src/lib/sound-store.ts` — read/write `sound-library.json` and `sound-mappings.json`, preview sounds, import audio, repair missing user data
- Create: `raycast-extension/src/manage-sounds.tsx` — primary Raycast view for per-slot sound assignment and install health
- Create: `raycast-extension/src/sound-library.tsx` — library browser with preview and import flows
- Modify: `raycast-extension/src/menu-bar-status.tsx` — show sound setup health and current playback details above status/history
- Modify: `raycast-extension/src/notify-event.tsx` — keep actionable event UI but expose `soundSlot` context in detail text

---

### Task 1: Generate the bundled default sound pack and manifest

**Files:**
- Modify: `package.json`
- Create: `scripts/generate-default-sounds.mjs`
- Create: `config/default-sound-pack.json`
- Create: `raycast-extension/assets/sounds/focus-bell.wav`
- Create: `raycast-extension/assets/sounds/soft-alert.wav`
- Create: `raycast-extension/assets/sounds/gentle-finish.wav`
- Create: `raycast-extension/assets/sounds/bright-success.wav`

- [ ] **Step 1: Create the default sound-pack manifest**

```json
{
  "version": 1,
  "sounds": [
    {
      "id": "focus-bell",
      "label": "Focus Bell",
      "kind": "bundled",
      "filename": "focus-bell.wav",
      "frequencyHz": 880,
      "durationMs": 220
    },
    {
      "id": "soft-alert",
      "label": "Soft Alert",
      "kind": "bundled",
      "filename": "soft-alert.wav",
      "frequencyHz": 330,
      "durationMs": 320
    },
    {
      "id": "gentle-finish",
      "label": "Gentle Finish",
      "kind": "bundled",
      "filename": "gentle-finish.wav",
      "frequencyHz": 660,
      "durationMs": 260
    },
    {
      "id": "bright-success",
      "label": "Bright Success",
      "kind": "bundled",
      "filename": "bright-success.wav",
      "frequencyHz": 990,
      "durationMs": 180
    }
  ],
  "defaults": {
    "needs_input": {
      "soundId": "focus-bell",
      "enabled": true
    },
    "failure": {
      "soundId": "soft-alert",
      "enabled": true
    },
    "done": {
      "soundId": "gentle-finish",
      "enabled": true
    },
    "success": {
      "soundId": "bright-success",
      "enabled": false
    },
    "running": {
      "soundId": null,
      "enabled": false
    }
  }
}
```

- [ ] **Step 2: Add a deterministic generator for the bundled `.wav` assets**

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const manifestPath = new URL("../config/default-sound-pack.json", import.meta.url);
const soundsDir = new URL("../raycast-extension/assets/sounds/", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const sound of manifest.sounds) {
  const fileUrl = new URL(sound.filename, soundsDir);
  await mkdir(dirname(fileUrl.pathname), { recursive: true });
  await writeFile(
    fileUrl,
    createWavBuffer({
      frequencyHz: sound.frequencyHz,
      durationMs: sound.durationMs,
    }),
  );
}

function createWavBuffer({ frequencyHz, durationMs, sampleRate = 44100, gain = 0.28 }) {
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const pcm = Buffer.alloc(totalSamples * 2);
  const attackSamples = Math.floor(sampleRate * 0.01);
  const releaseSamples = Math.floor(sampleRate * 0.03);

  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, index / Math.max(attackSamples, 1));
    const release = Math.min(1, (totalSamples - index) / Math.max(releaseSamples, 1));
    const envelope = Math.min(attack, release);
    const sample = Math.sin(2 * Math.PI * frequencyHz * time) * envelope * gain;
    pcm.writeInt16LE(Math.round(sample * 32767), index * 2);
  }

  return buildWav(pcm, sampleRate);
}

function buildWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
```

- [ ] **Step 3: Update the root package scripts for sound generation and sound-aware mocks**

```json
{
  "name": "claude-raycast-notifier",
  "private": true,
  "type": "module",
  "scripts": {
    "generate:sounds": "node scripts/generate-default-sounds.mjs",
    "test:hooks": "node --test hooks/tests/*.test.mjs",
    "mock:needs-input": "node hooks/mock-event.mjs needs_input | node hooks/claude-event-bridge.mjs",
    "mock:failure": "node hooks/mock-event.mjs failure | node hooks/claude-event-bridge.mjs",
    "mock:done": "node hooks/mock-event.mjs done | node hooks/claude-event-bridge.mjs",
    "mock:success": "node hooks/mock-event.mjs success | node hooks/claude-event-bridge.mjs"
  }
}
```

- [ ] **Step 4: Run the generator and confirm the four bundled `.wav` files exist**

Run: `npm run generate:sounds && ls raycast-extension/assets/sounds`

Expected:
- `bright-success.wav`
- `focus-bell.wav`
- `gentle-finish.wav`
- `soft-alert.wav`

- [ ] **Step 5: Commit the bundled sound pack scaffold**

```bash
git add package.json scripts/generate-default-sounds.mjs config/default-sound-pack.json raycast-extension/assets/sounds/*.wav
git commit -m "feat: add bundled default sound pack"
```

### Task 2: Build the hook-side sound configuration and repair layer

**Files:**
- Create: `hooks/lib/sound-config.mjs`
- Create: `hooks/tests/sound-config.test.mjs`

- [ ] **Step 1: Write the failing tests for install/repair and custom imports**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureUserData,
  importSound,
  readSoundLibrary,
  readSoundMappings,
} from "../lib/sound-config.mjs";

function tempRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("ensureUserData seeds bundled sounds and default mappings", async () => {
  const fixtureRoot = tempRoot("ccrn-fixture-");
  const userRoot = tempRoot("ccrn-user-");
  const bundledDir = join(fixtureRoot, "bundled");
  const manifestFile = join(fixtureRoot, "default-sound-pack.json");

  await mkdir(bundledDir, { recursive: true });
  await writeFile(join(bundledDir, "focus-bell.wav"), "bell");
  await writeFile(
    manifestFile,
    JSON.stringify({
      version: 1,
      sounds: [{ id: "focus-bell", label: "Focus Bell", kind: "bundled", filename: "focus-bell.wav" }],
      defaults: {
        needs_input: { soundId: "focus-bell", enabled: true },
        failure: { soundId: null, enabled: false },
        done: { soundId: null, enabled: false },
        success: { soundId: null, enabled: false },
        running: { soundId: null, enabled: false }
      }
    }, null, 2),
  );

  await ensureUserData({ rootDir: userRoot, manifestFile, bundledSoundsDir: bundledDir });

  const library = await readSoundLibrary(userRoot);
  const mappings = await readSoundMappings(userRoot);

  assert.equal(library.sounds[0].id, "focus-bell");
  assert.equal(mappings.slots.needs_input.soundId, "focus-bell");
});

test("importSound copies a custom file into the managed sound library", async () => {
  const fixtureRoot = tempRoot("ccrn-import-fixture-");
  const userRoot = tempRoot("ccrn-import-user-");
  const bundledDir = join(fixtureRoot, "bundled");
  const manifestFile = join(fixtureRoot, "default-sound-pack.json");
  const sourceFile = join(fixtureRoot, "custom.wav");

  await mkdir(bundledDir, { recursive: true });
  await writeFile(join(bundledDir, "focus-bell.wav"), "bell");
  await writeFile(sourceFile, "custom-tone");
  await writeFile(
    manifestFile,
    JSON.stringify({
      version: 1,
      sounds: [{ id: "focus-bell", label: "Focus Bell", kind: "bundled", filename: "focus-bell.wav" }],
      defaults: {
        needs_input: { soundId: "focus-bell", enabled: true },
        failure: { soundId: null, enabled: false },
        done: { soundId: null, enabled: false },
        success: { soundId: null, enabled: false },
        running: { soundId: null, enabled: false }
      }
    }, null, 2),
  );

  await ensureUserData({ rootDir: userRoot, manifestFile, bundledSoundsDir: bundledDir });
  const created = await importSound(sourceFile, "My Custom Sound", { rootDir: userRoot });
  const library = await readSoundLibrary(userRoot);
  const copied = await readFile(join(userRoot, "sounds", created.filename), "utf8");

  assert.equal(created.kind, "imported");
  assert.equal(copied, "custom-tone");
  assert.equal(library.sounds.at(-1).label, "My Custom Sound");
});
```

- [ ] **Step 2: Run the hook tests to verify the new module is missing**

Run: `npm run test:hooks`

Expected:
- FAIL with `ERR_MODULE_NOT_FOUND` for `hooks/lib/sound-config.mjs`

- [ ] **Step 3: Implement the shared sound configuration module**

```js
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, extname, join } from "node:path";

export function notifierPaths(rootDir = defaultRootDir()) {
  return {
    rootDir,
    soundsDir: join(rootDir, "sounds"),
    stateFile: join(rootDir, "state.json"),
    libraryFile: join(rootDir, "sound-library.json"),
    mappingsFile: join(rootDir, "sound-mappings.json"),
  };
}

export async function ensureUserData({
  rootDir = defaultRootDir(),
  manifestFile = defaultManifestFile(),
  bundledSoundsDir = defaultBundledSoundsDir(),
} = {}) {
  const paths = notifierPaths(rootDir);
  await mkdir(paths.soundsDir, { recursive: true });

  const manifest = await readDefaultPack(manifestFile);
  const existingLibrary = await readJson(paths.libraryFile, { version: 1, sounds: [] });
  const existingMappings = await readJson(paths.mappingsFile, null);

  for (const sound of manifest.sounds) {
    const bundledSource = join(bundledSoundsDir, sound.filename);
    const destination = join(paths.soundsDir, sound.filename);

    try {
      await stat(destination);
    } catch {
      await copyFile(bundledSource, destination);
    }
  }

  const mergedLibrary = {
    version: 1,
    sounds: mergeLibrary(existingLibrary.sounds, manifest.sounds),
  };

  await writeJson(paths.libraryFile, mergedLibrary);

  if (!existingMappings) {
    await writeJson(paths.mappingsFile, { version: 1, slots: manifest.defaults });
  }

  return {
    paths,
    library: await readSoundLibrary(rootDir),
    mappings: await readSoundMappings(rootDir),
  };
}

export async function readSoundLibrary(rootDir = defaultRootDir()) {
  const { libraryFile } = notifierPaths(rootDir);
  return readJson(libraryFile, { version: 1, sounds: [] });
}

export async function readSoundMappings(rootDir = defaultRootDir()) {
  const { mappingsFile } = notifierPaths(rootDir);
  return readJson(mappingsFile, {
    version: 1,
    slots: {
      needs_input: { soundId: null, enabled: false },
      failure: { soundId: null, enabled: false },
      done: { soundId: null, enabled: false },
      success: { soundId: null, enabled: false },
      running: { soundId: null, enabled: false },
    },
  });
}

export async function writeSoundMappings(rootDir, mappings) {
  const { mappingsFile } = notifierPaths(rootDir);
  await writeJson(mappingsFile, mappings);
  return mappings;
}

export async function importSound(sourceFile, label, { rootDir = defaultRootDir() } = {}) {
  const paths = notifierPaths(rootDir);
  await mkdir(paths.soundsDir, { recursive: true });

  const extension = extname(sourceFile) || ".wav";
  const filename = `${randomUUID()}${extension}`;
  await copyFile(sourceFile, join(paths.soundsDir, filename));

  const library = await readSoundLibrary(rootDir);
  const entry = {
    id: `imported-${randomUUID()}`,
    label,
    kind: "imported",
    filename,
    originalName: basename(sourceFile),
  };

  await writeJson(paths.libraryFile, {
    version: library.version,
    sounds: [...library.sounds, entry],
  });

  return entry;
}

export async function getInstallStatus(rootDir = defaultRootDir()) {
  const { libraryFile, mappingsFile, soundsDir } = notifierPaths(rootDir);
  const missing = [];

  for (const file of [libraryFile, mappingsFile, soundsDir]) {
    try {
      await stat(file);
    } catch {
      missing.push(file);
    }
  }

  return {
    rootDir,
    missing,
    healthy: missing.length === 0,
  };
}

async function readDefaultPack(manifestFile) {
  return JSON.parse(await readFile(manifestFile, "utf8"));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function mergeLibrary(existing, bundled) {
  const keptImported = existing.filter((entry) => entry.kind === "imported");
  return [...bundled, ...keptImported];
}

function defaultRootDir() {
  return process.env.CLAUDE_NOTIFIER_ROOT ?? `${process.env.HOME}/.claude-raycast-notifier`;
}

function defaultManifestFile() {
  return new URL("../../config/default-sound-pack.json", import.meta.url).pathname;
}

function defaultBundledSoundsDir() {
  return new URL("../../raycast-extension/assets/sounds/", import.meta.url).pathname;
}
```

- [ ] **Step 4: Fix the parent-directory write helper before moving on**

Replace this line in `hooks/lib/sound-config.mjs`:

```js
await mkdir(join(filePath, ".."), { recursive: true });
```

with this exact code:

```js
import { basename, dirname, extname, join } from "node:path";
```

and:

```js
await mkdir(dirname(filePath), { recursive: true });
```

- [ ] **Step 5: Re-run the hook tests and verify the install/import layer passes**

Run: `npm run test:hooks`

Expected:
- PASS for `hooks/tests/sound-config.test.mjs`
- PASS for the existing hook tests that still compile

- [ ] **Step 6: Commit the sound configuration layer**

```bash
git add hooks/lib/sound-config.mjs hooks/tests/sound-config.test.mjs
git commit -m "feat: add sound config and repair layer"
```

### Task 3: Add `soundSlot` normalization and playback metadata to runtime state

**Files:**
- Modify: `hooks/lib/event-schema.mjs`
- Modify: `hooks/tests/event-schema.test.mjs`
- Modify: `hooks/lib/state-store.mjs`
- Modify: `hooks/tests/state-store.test.mjs`

- [ ] **Step 1: Extend the event-schema tests to assert semantic sound slots**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isActionableEvent, normalizeEvent } from "../lib/event-schema.mjs";

test("normalizeEvent marks elicitation payloads as needs_input with a needs_input sound slot", () => {
  const event = normalizeEvent(
    {
      hook_event_name: "Elicitation",
      prompt: "Pick an answer",
      options: [{ id: "1", label: "Yes" }],
    },
    {},
  );

  assert.equal(event.type, "needs_input");
  assert.equal(event.soundSlot, "needs_input");
  assert.equal(event.action?.kind, "choice");
  assert.equal(isActionableEvent(event), true);
});

test("normalizeEvent maps failure payloads to the failure sound slot", () => {
  const event = normalizeEvent({ type: "failure", title: "Tests failed" }, {});
  assert.equal(event.soundSlot, "failure");
  assert.equal(event.severity, "error");
});
```

- [ ] **Step 2: Extend the state-store tests to cover sound playback metadata**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeEvent, writeSoundMeta } from "../lib/state-store.mjs";

test("writeSoundMeta stores the last played sound id and slot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ccrn-sound-meta-"));
  const filePath = join(dir, "state.json");

  await writeEvent(
    filePath,
    {
      type: "failure",
      title: "Claude hit an error",
      message: "The command failed",
      severity: "error",
      timestamp: "2026-04-08T10:00:00.000Z",
      durationMs: null,
      hookEventName: "Notification",
      notificationType: null,
      soundSlot: "failure",
      action: null,
    },
    5,
  );

  await writeSoundMeta(filePath, {
    lastPlayedAt: "2026-04-08T10:00:02.000Z",
    lastPlayedSoundId: "soft-alert",
    lastSlot: "failure",
    lastError: null,
  });

  const state = await readState(filePath);
  assert.equal(state.sound.lastPlayedSoundId, "soft-alert");
  assert.equal(state.sound.lastSlot, "failure");
});
```

- [ ] **Step 3: Run the hook tests to confirm the new expectations fail first**

Run: `npm run test:hooks`

Expected:
- FAIL because `soundSlot` and `writeSoundMeta` are not implemented yet

- [ ] **Step 4: Update the event normalizer to derive a semantic slot for every event**

```js
const DEFAULT_SEVERITY = {
  running: "info",
  needs_input: "warning",
  success: "info",
  failure: "error",
  done: "info",
};

export function normalizeEvent(raw = {}, env = process.env) {
  const type = raw.type ?? env.CLAUDE_HOOK_EVENT_TYPE ?? inferType(raw, env);
  const title = raw.title ?? defaultTitle(type);
  const message = raw.message ?? raw.summary ?? "Claude event received";
  const hookEventName = raw.hook_event_name ?? env.CLAUDE_HOOK_EVENT_NAME ?? null;
  const notificationType = raw.notification_type ?? null;
  const action = extractAction(raw, type, hookEventName);

  return {
    type,
    title,
    message,
    severity: raw.severity ?? DEFAULT_SEVERITY[type] ?? "info",
    timestamp: raw.timestamp ?? new Date().toISOString(),
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : null,
    hookEventName,
    notificationType,
    soundSlot: deriveSoundSlot(type, hookEventName),
    action,
  };
}

export function isActionableEvent(event) {
  return event.action !== null || event.type === "needs_input";
}

function deriveSoundSlot(type, hookEventName) {
  if (hookEventName === "Elicitation" || type === "needs_input") return "needs_input";
  if (type === "failure") return "failure";
  if (type === "done") return "done";
  if (type === "success") return "success";
  return "running";
}

function inferType(raw, env) {
  const hookEventName = raw.hook_event_name ?? env.CLAUDE_HOOK_EVENT_NAME;
  if (hookEventName === "Elicitation") return "needs_input";
  return "running";
}

function extractAction(raw, type, hookEventName) {
  const options = normalizeOptions(raw.options ?? raw.choices ?? raw.items ?? []);
  const prompt = raw.prompt ?? raw.title ?? null;
  const placeholder = raw.placeholder ?? raw.input_placeholder ?? undefined;
  const submitHint = raw.submitHint ?? raw.submit_hint ?? undefined;

  if (options.length > 0) {
    return {
      kind: "choice",
      prompt,
      options,
      placeholder,
      submitHint,
    };
  }

  if (hookEventName === "Elicitation" && (placeholder !== undefined || type === "needs_input")) {
    return {
      kind: "input",
      prompt,
      options: undefined,
      placeholder,
      submitHint,
    };
  }

  return null;
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  return options
    .map((option, index) => {
      if (typeof option === "string") {
        return { id: option, label: option, detail: undefined };
      }

      if (!option || typeof option !== "object") return null;

      const label = option.label ?? option.title ?? option.name ?? option.value;
      if (!label) return null;

      return {
        id: String(option.value ?? option.id ?? label ?? index),
        label: String(label),
        detail:
          typeof option.detail === "string"
            ? option.detail
            : typeof option.description === "string"
              ? option.description
              : undefined,
      };
    })
    .filter(Boolean);
}

function defaultTitle(type) {
  if (type === "needs_input") return "Claude needs your input";
  if (type === "failure") return "Claude hit an error";
  if (type === "done") return "Claude finished the task";
  if (type === "success") return "Claude completed the command";
  return "Claude is working";
}
```

- [ ] **Step 5: Expand runtime state to store sound playback information**

```js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function defaultState() {
  return {
    current: null,
    recent: [],
    sound: {
      lastPlayedAt: null,
      lastPlayedSoundId: null,
      lastSlot: null,
      lastError: null,
    },
  };
}

export async function readState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}

export async function writeEvent(filePath, event, maxRecent = 10) {
  const state = await readState(filePath);
  const next = {
    ...state,
    current: event,
    recent: [event, ...state.recent].slice(0, maxRecent),
  };

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}

export async function writeSoundMeta(filePath, sound) {
  const state = await readState(filePath);
  const next = { ...state, sound };
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}
```

- [ ] **Step 6: Re-run the hook tests and confirm the slot/state updates pass**

Run: `npm run test:hooks`

Expected:
- PASS for `hooks/tests/event-schema.test.mjs`
- PASS for `hooks/tests/state-store.test.mjs`
- PASS for `hooks/tests/sound-config.test.mjs`

- [ ] **Step 7: Commit the sound-slot event model**

```bash
git add hooks/lib/event-schema.mjs hooks/tests/event-schema.test.mjs hooks/lib/state-store.mjs hooks/tests/state-store.test.mjs
git commit -m "feat: add sound slot normalization"
```

### Task 4: Replace spoken voice with mapped sound playback in the hook bridge

**Files:**
- Create: `hooks/lib/playback.mjs`
- Create: `hooks/tests/playback.test.mjs`
- Modify: `hooks/claude-event-bridge.mjs`
- Modify: `hooks/mock-event.mjs`
- Modify: `package.json`
- Delete: `hooks/lib/voice.mjs`
- Delete: `hooks/tests/voice.test.mjs`

- [ ] **Step 1: Write the failing tests for playback resolution**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureUserData } from "../lib/sound-config.mjs";
import { resolveSoundForEvent } from "../lib/playback.mjs";

function tempRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("resolveSoundForEvent returns the configured file for an enabled slot", async () => {
  const fixtureRoot = tempRoot("ccrn-playback-fixture-");
  const userRoot = tempRoot("ccrn-playback-user-");
  const bundledDir = join(fixtureRoot, "bundled");
  const manifestFile = join(fixtureRoot, "default-sound-pack.json");

  await mkdir(bundledDir, { recursive: true });
  await writeFile(join(bundledDir, "soft-alert.wav"), "alert");
  await writeFile(
    manifestFile,
    JSON.stringify({
      version: 1,
      sounds: [{ id: "soft-alert", label: "Soft Alert", kind: "bundled", filename: "soft-alert.wav" }],
      defaults: {
        needs_input: { soundId: null, enabled: false },
        failure: { soundId: "soft-alert", enabled: true },
        done: { soundId: null, enabled: false },
        success: { soundId: null, enabled: false },
        running: { soundId: null, enabled: false }
      }
    }, null, 2),
  );

  await ensureUserData({ rootDir: userRoot, manifestFile, bundledSoundsDir: bundledDir });

  const resolved = await resolveSoundForEvent(
    { soundSlot: "failure" },
    { rootDir: userRoot },
  );

  assert.equal(resolved.soundId, "soft-alert");
  assert.equal(resolved.reason, null);
  assert.match(resolved.filePath, /soft-alert\.wav$/);
});

test("resolveSoundForEvent reports disabled slots without a file path", async () => {
  const fixtureRoot = tempRoot("ccrn-playback-disabled-fixture-");
  const userRoot = tempRoot("ccrn-playback-disabled-user-");
  const bundledDir = join(fixtureRoot, "bundled");
  const manifestFile = join(fixtureRoot, "default-sound-pack.json");

  await mkdir(bundledDir, { recursive: true });
  await writeFile(join(bundledDir, "focus-bell.wav"), "bell");
  await writeFile(
    manifestFile,
    JSON.stringify({
      version: 1,
      sounds: [{ id: "focus-bell", label: "Focus Bell", kind: "bundled", filename: "focus-bell.wav" }],
      defaults: {
        needs_input: { soundId: "focus-bell", enabled: false },
        failure: { soundId: null, enabled: false },
        done: { soundId: null, enabled: false },
        success: { soundId: null, enabled: false },
        running: { soundId: null, enabled: false }
      }
    }, null, 2),
  );

  await ensureUserData({ rootDir: userRoot, manifestFile, bundledSoundsDir: bundledDir });

  const resolved = await resolveSoundForEvent(
    { soundSlot: "needs_input" },
    { rootDir: userRoot },
  );

  assert.equal(resolved.filePath, null);
  assert.equal(resolved.reason, "disabled");
});
```

- [ ] **Step 2: Run the hook tests to verify the playback module does not exist yet**

Run: `npm run test:hooks`

Expected:
- FAIL with `ERR_MODULE_NOT_FOUND` for `hooks/lib/playback.mjs`

- [ ] **Step 3: Implement the playback resolver and `afplay` transport**

```js
import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { notifierPaths, readSoundLibrary, readSoundMappings } from "./sound-config.mjs";

const execFileAsync = promisify(execFile);

export async function resolveSoundForEvent(event, { rootDir } = {}) {
  const { soundsDir } = notifierPaths(rootDir);
  const library = await readSoundLibrary(rootDir);
  const mappings = await readSoundMappings(rootDir);
  const mapping = mappings.slots[event.soundSlot] ?? { soundId: null, enabled: false };

  if (!mapping.enabled || !mapping.soundId) {
    return {
      soundId: mapping.soundId,
      slot: event.soundSlot,
      filePath: null,
      reason: "disabled",
    };
  }

  const sound = library.sounds.find((entry) => entry.id === mapping.soundId);
  if (!sound) {
    return {
      soundId: mapping.soundId,
      slot: event.soundSlot,
      filePath: null,
      reason: "missing_sound",
    };
  }

  const filePath = join(soundsDir, sound.filename);

  try {
    await access(filePath);
  } catch {
    return {
      soundId: sound.id,
      slot: event.soundSlot,
      filePath: null,
      reason: "missing_file",
    };
  }

  return {
    soundId: sound.id,
    slot: event.soundSlot,
    filePath,
    reason: null,
  };
}

export async function playSoundForEvent(event, options = {}) {
  const resolved = await resolveSoundForEvent(event, options);
  if (!resolved.filePath) return { ...resolved, played: false };

  await execFileAsync("afplay", [resolved.filePath]);
  return { ...resolved, played: true };
}

export async function previewSound(filePath) {
  await execFileAsync("afplay", [filePath]);
}
```

- [ ] **Step 4: Replace the bridge's `say` logic with sound-pack playback and sound-aware state writes**

```js
import { isActionableEvent, normalizeEvent } from "./lib/event-schema.mjs";
import { ensureUserData, notifierPaths } from "./lib/sound-config.mjs";
import { playSoundForEvent } from "./lib/playback.mjs";
import { writeEvent, writeSoundMeta } from "./lib/state-store.mjs";
import { triggerRaycast } from "./lib/raycast-deeplink.mjs";
import { showMacNotification } from "./lib/fallback-notifier.mjs";

const ROOT_DIR = process.env.CLAUDE_NOTIFIER_ROOT ?? `${process.env.HOME}/.claude-raycast-notifier`;
const MAX_RECENT = Number(process.env.CLAUDE_NOTIFIER_MAX_RECENT ?? "10");

await ensureUserData({ rootDir: ROOT_DIR });
const { stateFile } = notifierPaths(ROOT_DIR);

const rawInput = await readStdin();
const raw = rawInput ? JSON.parse(rawInput) : {};
const event = normalizeEvent(raw, process.env);
const state = await writeEvent(stateFile, event, MAX_RECENT);
const playback = await playSoundForEvent(event, { rootDir: ROOT_DIR });

await writeSoundMeta(stateFile, {
  lastPlayedAt: playback.played ? new Date().toISOString() : null,
  lastPlayedSoundId: playback.soundId,
  lastSlot: playback.slot,
  lastError: playback.reason,
});

try {
  if (isActionableEvent(event)) {
    await triggerRaycast(event);
  } else {
    await showMacNotification(event.title, event.message);
  }
} catch {
  await showMacNotification(event.title, event.message);
}

process.stdout.write(
  JSON.stringify({
    current: state.current,
    playback,
  }),
);

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}
```

- [ ] **Step 5: Expand the mock-event generator and root scripts to cover `success`**

```js
const type = process.argv[2] ?? "needs_input";

const event = {
  needs_input: {
    hook_event_name: "Elicitation",
    prompt: "Choose the next action",
    title: "Claude needs your input",
    message: "Pick one of the Raycast options",
    options: [
      { id: "apply", label: "Apply changes", detail: "Use the proposed patch" },
      { id: "revise", label: "Revise patch", detail: "Return and edit the patch" }
    ]
  },
  failure: {
    type: "failure",
    title: "Claude hit an error",
    message: "The last command failed"
  },
  done: {
    type: "done",
    title: "Claude finished the task",
    message: "Implementation and checks are complete"
  },
  success: {
    type: "success",
    title: "Claude completed the command",
    message: "The command finished successfully"
  }
}[type];

if (!event) {
  console.error(`Unknown event type: ${type}`);
  process.exit(1);
}

process.stdout.write(JSON.stringify(event));
```

and:

```json
{
  "scripts": {
    "generate:sounds": "node scripts/generate-default-sounds.mjs",
    "test:hooks": "node --test hooks/tests/*.test.mjs",
    "mock:needs-input": "node hooks/mock-event.mjs needs_input | node hooks/claude-event-bridge.mjs",
    "mock:failure": "node hooks/mock-event.mjs failure | node hooks/claude-event-bridge.mjs",
    "mock:done": "node hooks/mock-event.mjs done | node hooks/claude-event-bridge.mjs",
    "mock:success": "node hooks/mock-event.mjs success | node hooks/claude-event-bridge.mjs"
  }
}
```

- [ ] **Step 6: Remove the obsolete `say`-based voice files once the bridge imports no longer reference them**

Run:
- `git rm hooks/lib/voice.mjs`
- `git rm hooks/tests/voice.test.mjs`

Expected:
- both files are removed from the index
- `hooks/claude-event-bridge.mjs` no longer imports `shouldSpeak` or `speak`

- [ ] **Step 7: Re-run tests and manually verify the bridge writes sound metadata**

Run:
- `npm run test:hooks`
- `npm run mock:failure`
- `python3 -m json.tool ~/.claude-raycast-notifier/state.json`

Expected:
- all hook tests pass
- the mock command plays `soft-alert.wav`
- `state.json` contains `sound.lastPlayedSoundId` set to `soft-alert`
- passive failure flow uses macOS notification and does not foreground Raycast

- [ ] **Step 8: Commit the sound playback bridge**

```bash
git add package.json hooks/lib/playback.mjs hooks/tests/playback.test.mjs hooks/claude-event-bridge.mjs hooks/mock-event.mjs hooks/lib/event-schema.mjs hooks/lib/state-store.mjs
git commit -m "feat: replace voice with mapped hook sounds"
```

### Task 5: Add Raycast-side sound storage, preview, and repair helpers

**Files:**
- Modify: `raycast-extension/package.json`
- Modify: `raycast-extension/src/lib/event.ts`
- Modify: `raycast-extension/src/lib/state.ts`
- Create: `raycast-extension/src/lib/sound-store.ts`

- [ ] **Step 1: Update the Raycast manifest for sound management**

```json
{
  "$schema": "https://www.raycast.com/schemas/extension.json",
  "name": "claude-raycast-notifier",
  "title": "Claude Hook Sounds",
  "description": "Manage Claude Code hook sounds and actionable notifications in Raycast.",
  "icon": "icon.png",
  "author": "lee_fulln",
  "license": "MIT",
  "categories": ["Developer Tools", "Productivity"],
  "commands": [
    {
      "name": "menu-bar-status",
      "title": "Claude Status",
      "description": "Show Claude status, sound setup health, and recent events in the Raycast menu bar",
      "mode": "menu-bar"
    },
    {
      "name": "manage-sounds",
      "title": "Manage Claude Sounds",
      "description": "Assign sounds to Claude hook event slots",
      "mode": "view"
    },
    {
      "name": "sound-library",
      "title": "Claude Sound Library",
      "description": "Preview bundled and imported Claude hook sounds",
      "mode": "view"
    },
    {
      "name": "notify-event",
      "title": "Notify Claude Event",
      "description": "Render an actionable Claude event and return you to Claude Code",
      "mode": "no-view",
      "arguments": [
        {
          "name": "payload",
          "description": "Base64 encoded event payload",
          "type": "text",
          "placeholder": "Base64 event payload",
          "required": true
        }
      ]
    }
  ],
  "preferences": [
    {
      "name": "stateFilePath",
      "title": "State File Path",
      "description": "Path to the shared Claude notifier state file",
      "type": "textfield",
      "default": "~/.claude-raycast-notifier/state.json",
      "required": true
    },
    {
      "name": "notifierRootPath",
      "title": "Notifier Root Path",
      "description": "Directory containing sound-library.json, sound-mappings.json, and managed sound assets",
      "type": "textfield",
      "default": "~/.claude-raycast-notifier",
      "required": true
    }
  ],
  "dependencies": {
    "@raycast/api": "^1.83.0"
  },
  "devDependencies": {
    "@raycast/eslint-config": "^1.0.11",
    "@types/node": "22.5.4",
    "@types/react": "18.3.3",
    "eslint": "^8.57.0",
    "prettier": "^3.3.3",
    "typescript": "^5.4.5"
  },
  "scripts": {
    "dev": "ray develop",
    "build": "ray build --skip-types -e dist -o dist",
    "lint": "ray lint"
  }
}
```

- [ ] **Step 2: Extend the shared event and state types with sound metadata**

```ts
export type SoundSlot = "running" | "needs_input" | "success" | "failure" | "done";

export type ClaudeActionOption = {
  id: string;
  label: string;
  detail?: string;
};

export type ClaudeAction = {
  kind: "choice" | "input";
  prompt?: string | null;
  options?: ClaudeActionOption[];
  placeholder?: string;
  submitHint?: string;
};

export type ClaudeEvent = {
  type: "running" | "needs_input" | "success" | "failure" | "done";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: string;
  durationMs: number | null;
  hookEventName?: string | null;
  notificationType?: string | null;
  soundSlot: SoundSlot;
  action: ClaudeAction | null;
};

export function decodePayload(payload: string): ClaudeEvent {
  const json = Buffer.from(payload, "base64").toString("utf8");
  return JSON.parse(json) as ClaudeEvent;
}
```

and:

```ts
import { getPreferenceValues } from "@raycast/api";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import type { ClaudeEvent, SoundSlot } from "./event";

export type NotifierState = {
  current: ClaudeEvent | null;
  recent: ClaudeEvent[];
  sound: {
    lastPlayedAt: string | null;
    lastPlayedSoundId: string | null;
    lastSlot: SoundSlot | null;
    lastError: string | null;
  };
};

type Preferences = { stateFilePath: string };

export async function loadState(): Promise<NotifierState> {
  const prefs = getPreferenceValues<Preferences>();
  const path = prefs.stateFilePath.replace(/^~(?=\/)/, homedir());

  try {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw) as NotifierState;
  } catch {
    return {
      current: null,
      recent: [],
      sound: {
        lastPlayedAt: null,
        lastPlayedSoundId: null,
        lastSlot: null,
        lastError: null,
      },
    };
  }
}
```

- [ ] **Step 3: Create a Raycast helper for managed sound-library reads, writes, preview, and repair**

```ts
import { getPreferenceValues } from "@raycast/api";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { SoundSlot } from "./event";

const execFileAsync = promisify(execFile);

type Preferences = { notifierRootPath: string };

export type SoundEntry = {
  id: string;
  label: string;
  kind: "bundled" | "imported";
  filename: string;
  originalName?: string;
};

export type SoundMappings = {
  version: number;
  slots: Record<SoundSlot, { soundId: string | null; enabled: boolean }>;
};

export async function loadSoundLibrary() {
  const paths = notifierPaths();
  return readJson(paths.libraryFile, { version: 1, sounds: [] as SoundEntry[] });
}

export async function loadSoundMappings() {
  const paths = notifierPaths();
  return readJson(paths.mappingsFile, {
    version: 1,
    slots: {
      needs_input: { soundId: null, enabled: false },
      failure: { soundId: null, enabled: false },
      done: { soundId: null, enabled: false },
      success: { soundId: null, enabled: false },
      running: { soundId: null, enabled: false },
    },
  } as SoundMappings);
}

export async function saveSoundMappings(mappings: SoundMappings) {
  const paths = notifierPaths();
  await fs.mkdir(dirname(paths.mappingsFile), { recursive: true });
  await fs.writeFile(paths.mappingsFile, JSON.stringify(mappings, null, 2));
}

export async function importSoundFile(sourcePath: string, label: string) {
  const paths = notifierPaths();
  await fs.mkdir(paths.soundsDir, { recursive: true });

  const filename = `${randomUUID()}${extname(sourcePath) || ".wav"}`;
  await fs.copyFile(sourcePath, join(paths.soundsDir, filename));

  const library = await loadSoundLibrary();
  const created = {
    id: `imported-${randomUUID()}`,
    label,
    kind: "imported" as const,
    filename,
    originalName: basename(sourcePath),
  };

  await fs.writeFile(
    paths.libraryFile,
    JSON.stringify({ version: library.version, sounds: [...library.sounds, created] }, null, 2),
  );

  return created;
}

export async function previewSoundFile(filePath: string) {
  await execFileAsync("afplay", [filePath]);
}

export async function repairUserData() {
  const manifest = await readJson(defaultManifestPath(), { version: 1, sounds: [], defaults: {} });
  const paths = notifierPaths();
  await fs.mkdir(paths.soundsDir, { recursive: true });

  for (const sound of manifest.sounds) {
    const source = join(defaultSoundsDir(), sound.filename);
    const destination = join(paths.soundsDir, sound.filename);
    try {
      await fs.access(destination);
    } catch {
      await fs.copyFile(source, destination);
    }
  }

  try {
    await fs.access(paths.libraryFile);
  } catch {
    await fs.writeFile(
      paths.libraryFile,
      JSON.stringify(
        {
          version: 1,
          sounds: manifest.sounds.map(({ id, label, kind, filename }: SoundEntry) => ({ id, label, kind, filename })),
        },
        null,
        2,
      ),
    );
  }

  try {
    await fs.access(paths.mappingsFile);
  } catch {
    await fs.writeFile(paths.mappingsFile, JSON.stringify({ version: 1, slots: manifest.defaults }, null, 2));
  }
}

export async function loadInstallStatus() {
  const paths = notifierPaths();
  const missing: string[] = [];

  for (const file of [paths.libraryFile, paths.mappingsFile, paths.soundsDir]) {
    try {
      await fs.access(file);
    } catch {
      missing.push(file);
    }
  }

  return {
    rootDir: paths.rootDir,
    missing,
    healthy: missing.length === 0,
  };
}

export function resolveManagedSoundPath(filename: string) {
  return join(notifierPaths().soundsDir, filename);
}

function notifierPaths() {
  const prefs = getPreferenceValues<Preferences>();
  const rootDir = prefs.notifierRootPath.replace(/^~(?=\/)/, homedir());
  return {
    rootDir,
    soundsDir: join(rootDir, "sounds"),
    stateFile: join(rootDir, "state.json"),
    libraryFile: join(rootDir, "sound-library.json"),
    mappingsFile: join(rootDir, "sound-mappings.json"),
  };
}

function defaultManifestPath() {
  return resolve(process.cwd(), "../config/default-sound-pack.json");
}

function defaultSoundsDir() {
  return resolve(process.cwd(), "assets/sounds");
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 4: Install dependencies and lint the extension before building UI files**

Run: `npm --prefix raycast-extension install && npm --prefix raycast-extension run lint`

Expected:
- dependencies install successfully
- lint exits with code 0 after the shared helpers compile

- [ ] **Step 5: Commit the shared Raycast sound helpers**

```bash
git add raycast-extension/package.json raycast-extension/src/lib/event.ts raycast-extension/src/lib/state.ts raycast-extension/src/lib/sound-store.ts
git commit -m "feat: add raycast sound store helpers"
```

### Task 6: Build the Raycast sound-management views for slot mapping and imports

**Files:**
- Create: `raycast-extension/src/manage-sounds.tsx`
- Create: `raycast-extension/src/sound-library.tsx`

- [ ] **Step 1: Create the main slot-mapping view**

```tsx
import {
  Action,
  ActionPanel,
  Icon,
  List,
  showHUD,
  usePromise,
} from "@raycast/api";
import { loadInstallStatus, loadSoundLibrary, loadSoundMappings, previewSoundFile, repairUserData, resolveManagedSoundPath, saveSoundMappings } from "./lib/sound-store";
import type { SoundSlot } from "./lib/event";
import { SoundLibraryView } from "./sound-library";

const SLOT_ORDER: SoundSlot[] = ["needs_input", "failure", "done", "success", "running"];

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(async () => {
    const [mappings, library, install] = await Promise.all([
      loadSoundMappings(),
      loadSoundLibrary(),
      loadInstallStatus(),
    ]);

    return { mappings, library, install };
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter Claude sound slots">
      <List.Section title="Install Health" subtitle={data?.install.healthy ? "Healthy" : "Repair needed"}>
        <List.Item
          icon={data?.install.healthy ? Icon.CheckCircle : Icon.ExclamationMark}
          title={data?.install.healthy ? "Sound setup ready" : "Missing sound files or mapping files"}
          subtitle={data?.install.missing.join(" • ") || "Bundled sounds and mappings are installed"}
          actions={
            <ActionPanel>
              <Action
                title="Repair Sound Setup"
                onAction={async () => {
                  await repairUserData();
                  await showHUD("Repaired sound setup");
                  await revalidate();
                }}
              />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Sound Slots">
        {SLOT_ORDER.map((slot) => {
          const mapping = data?.mappings.slots[slot];
          const sound = data?.library.sounds.find((entry) => entry.id === mapping?.soundId);
          const subtitle = mapping?.enabled
            ? sound?.label ?? "Missing sound"
            : "Muted";

          return (
            <List.Item
              key={slot}
              icon={mapping?.enabled ? Icon.Music : Icon.Muted}
              title={slot}
              subtitle={subtitle}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Choose Sound"
                    target={<SoundLibraryView slot={slot} onAssigned={revalidate} />}
                  />
                  {sound ? (
                    <Action
                      title="Preview Current Sound"
                      onAction={() => previewSoundFile(resolveManagedSoundPath(sound.filename))}
                    />
                  ) : null}
                  <Action
                    title={mapping?.enabled ? "Mute Slot" : "Enable Slot"}
                    onAction={async () => {
                      await saveSoundMappings({
                        ...data!.mappings,
                        slots: {
                          ...data!.mappings.slots,
                          [slot]: {
                            ...data!.mappings.slots[slot],
                            enabled: !data!.mappings.slots[slot].enabled,
                          },
                        },
                      });
                      await showHUD(`${slot} updated`);
                      await revalidate();
                    }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
```

- [ ] **Step 2: Create the sound-library view with preview, assignment, and import form flow**

```tsx
import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  showHUD,
  useNavigation,
  usePromise,
} from "@raycast/api";
import { importSoundFile, loadSoundLibrary, loadSoundMappings, previewSoundFile, resolveManagedSoundPath, saveSoundMappings } from "./lib/sound-store";
import type { SoundSlot } from "./lib/event";

export function SoundLibraryView(props: { slot?: SoundSlot; onAssigned?: () => void | Promise<void> }) {
  const { data, isLoading, revalidate } = usePromise(loadSoundLibrary, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter bundled and imported sounds">
      <List.Section title={props.slot ? `Assign to ${props.slot}` : "Sound Library"}>
        {(data?.sounds ?? []).map((sound) => (
          <List.Item
            key={sound.id}
            icon={sound.kind === "bundled" ? Icon.Stars : Icon.Document}
            title={sound.label}
            subtitle={sound.kind === "bundled" ? "Bundled" : sound.originalName ?? "Imported"}
            actions={
              <ActionPanel>
                {props.slot ? (
                  <Action
                    title={`Assign to ${props.slot}`}
                    onAction={async () => {
                      const mappings = await loadSoundMappings();
                      await saveSoundMappings({
                        ...mappings,
                        slots: {
                          ...mappings.slots,
                          [props.slot!]: { soundId: sound.id, enabled: true },
                        },
                      });
                      await showHUD(`${sound.label} assigned to ${props.slot}`);
                      await props.onAssigned?.();
                    }}
                  />
                ) : null}
                <Action
                  title="Preview Sound"
                  onAction={() => previewSoundFile(resolveManagedSoundPath(sound.filename))}
                />
                <Action.Push title="Import Custom Sound" target={<ImportSoundForm onImported={revalidate} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function Command() {
  return <SoundLibraryView />;
}

function ImportSoundForm(props: { onImported?: () => void | Promise<void> }) {
  const { pop } = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Import Sound"
            onSubmit={async (values: { label: string; source: string[] }) => {
              const sourcePath = values.source[0];
              const label = values.label.trim() || "Imported Sound";
              await importSoundFile(sourcePath, label);
              await showHUD(`Imported ${label}`);
              await props.onImported?.();
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="label" title="Label" placeholder="My custom alert" />
      <Form.FilePicker id="source" title="Audio File" allowMultipleSelection={false} />
    </Form>
  );
}
```

- [ ] **Step 3: Lint the extension and open the views in Raycast**

Run:
- `npm --prefix raycast-extension run lint`
- `npm --prefix raycast-extension run dev`

Expected:
- lint exits with code 0
- Raycast shows `Manage Claude Sounds` and `Claude Sound Library`

- [ ] **Step 4: Manually verify slot reassignment and custom import**

Run and do:
- open `Manage Claude Sounds` in Raycast
- assign `Gentle Finish` to the `done` slot
- import one local `.wav` file through `Import Sound`

Expected:
- `~/.claude-raycast-notifier/sound-mappings.json` changes for the selected slot
- `~/.claude-raycast-notifier/sound-library.json` gains one `imported-*` entry
- the imported file is copied under `~/.claude-raycast-notifier/sounds/`

- [ ] **Step 5: Commit the Raycast sound-management views**

```bash
git add raycast-extension/src/manage-sounds.tsx raycast-extension/src/sound-library.tsx
git commit -m "feat: add raycast sound management views"
```

### Task 7: Update the Menu Bar, actionable view, hooks example, and verification flow

**Files:**
- Modify: `raycast-extension/src/menu-bar-status.tsx`
- Modify: `raycast-extension/src/notify-event.tsx`
- Modify: `config/claude-hooks.example.json`

- [ ] **Step 1: Update the Menu Bar to show sound setup health and last playback details**

```tsx
import {
  Action,
  ActionPanel,
  Icon,
  MenuBarExtra,
  openCommandPreferences,
  openExtensionPreferences,
  usePromise,
} from "@raycast/api";
import { loadState } from "./lib/state";
import { loadInstallStatus } from "./lib/sound-store";

export default function Command() {
  const { data, isLoading } = usePromise(async () => {
    const [state, install] = await Promise.all([loadState(), loadInstallStatus()]);
    return { state, install };
  }, []);

  const current = data?.state.current;

  return (
    <MenuBarExtra
      icon={iconFor(current?.severity, Boolean(current?.action), data?.install.healthy ?? true)}
      title={titleFor(current, isLoading)}
    >
      {current?.action ? (
        <MenuBarExtra.Section title="Action Required">
          <MenuBarExtra.Item title={current.title} subtitle={current.message} />
        </MenuBarExtra.Section>
      ) : null}
      <MenuBarExtra.Section title="Sound Setup">
        <MenuBarExtra.Item
          title={data?.install.healthy ? "Sound setup ready" : "Sound setup needs repair"}
          subtitle={data?.install.missing.join(" • ") || data?.state.sound.lastPlayedSoundId || "No sound played yet"}
        />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Current Status">
        <MenuBarExtra.Item title={current?.title ?? "Claude idle"} subtitle={current?.message ?? "No events yet"} />
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Recent Events">
        {(data?.state.recent ?? []).slice(0, 5).map((event) => (
          <MenuBarExtra.Item
            key={`${event.timestamp}-${event.type}`}
            title={event.title}
            subtitle={`${event.soundSlot} • ${event.message}`}
          />
        ))}
      </MenuBarExtra.Section>
      <MenuBarExtra.Item title="Extension Preferences" onAction={openExtensionPreferences} />
      <MenuBarExtra.Item title="Command Preferences" onAction={openCommandPreferences} />
      <MenuBarExtra.Item title="Manage Claude Sounds" icon={Icon.Music} command={{ name: "manage-sounds" }} />
    </MenuBarExtra>
  );
}

function titleFor(current: { type: string; action?: unknown } | null | undefined, isLoading: boolean) {
  if (isLoading) return "Claude…";
  if (!current) return "Claude Idle";
  if (current.action) return "Action Required";
  if (current.type === "needs_input") return "Claude Waiting";
  if (current.type === "failure") return "Claude Error";
  if (current.type === "done") return "Claude Done";
  return "Claude Working";
}

function iconFor(severity: string | undefined, actionable: boolean, healthy: boolean) {
  if (!healthy) return Icon.ExclamationMark;
  if (actionable) return Icon.Bell;
  if (severity === "error") return Icon.XMarkCircle;
  if (severity === "warning") return Icon.ExclamationMark;
  return Icon.Terminal;
}
```

- [ ] **Step 2: Update the actionable view to show which sound slot is attached to the current event**

```tsx
function detailMarkdown(
  title: string,
  message: string,
  option: ClaudeActionOption,
  soundSlot: string,
) {
  return [
    `# ${title}`,
    "",
    message,
    "",
    `Sound slot: **${soundSlot}**`,
    "",
    `Selected option: **${option.label}**`,
  ].join("\n");
}
```

and update the caller in `raycast-extension/src/notify-event.tsx` from:

```tsx
markdown={detailMarkdown(event.title, event.message, option)}
```

to:

```tsx
markdown={detailMarkdown(event.title, event.message, option, event.soundSlot)}
```

- [ ] **Step 3: Update the example Claude hook config so all supported hook families route through the bridge**

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/fulln/.claude/bin/claude-raycast-notifier/hooks/claude-event-bridge.mjs 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/fulln/.claude/bin/claude-raycast-notifier/hooks/claude-event-bridge.mjs 2>/dev/null || true"
          }
        ]
      }
    ],
    "Elicitation": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/fulln/.claude/bin/claude-raycast-notifier/hooks/claude-event-bridge.mjs 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Run the full local verification suite**

Run:
- `npm run generate:sounds`
- `npm run test:hooks`
- `npm --prefix raycast-extension run lint`
- `npm run mock:needs-input`
- `npm run mock:failure`
- `npm run mock:done`
- `python3 -m json.tool ~/.claude-raycast-notifier/sound-mappings.json`
- `python3 -m json.tool ~/.claude-raycast-notifier/state.json`

Expected:
- generated bundled `.wav` files still exist
- hook tests pass
- Raycast lint passes
- `needs_input` plays `focus-bell.wav` and foregrounds Raycast
- `failure` plays `soft-alert.wav`, updates state, and stays on macOS notification
- `done` plays `gentle-finish.wav`, updates state, and stays on macOS notification
- `sound-mappings.json` and `state.json` both exist under `~/.claude-raycast-notifier/`

- [ ] **Step 5: Manually verify that changing a Raycast mapping affects the next real hook playback**

Do:
- open `Manage Claude Sounds` in Raycast
- assign `Bright Success` to `done`
- run `npm run mock:done`

Expected:
- the next `done` playback uses `bright-success.wav`
- `~/.claude-raycast-notifier/state.json` records `lastPlayedSoundId` as `bright-success`

- [ ] **Step 6: Commit the sound-aware Raycast UI and hook wiring docs**

```bash
git add raycast-extension/src/menu-bar-status.tsx raycast-extension/src/notify-event.tsx config/claude-hooks.example.json
git commit -m "feat: wire sound management into raycast status"
```

---

## Spec Coverage Check

- **Default sound pack and user directory initialization:** Tasks 1 and 2
- **`soundSlot` event normalization:** Task 3
- **`sound-mappings.json` and `sound-library.json` storage:** Tasks 2 and 5
- **Bridge playback and passive/actionable routing:** Task 4
- **Raycast Menu Bar status and sound-management views:** Tasks 5, 6, and 7
- **Preview and custom audio import:** Tasks 5 and 6
- **Repair/install checks:** Tasks 2, 5, and 6
- **Mock events and local verification:** Tasks 4 and 7
- **Claude Code hook config integration:** Task 7

## Notes for the implementing agent

- Keep the semantic slot list small: `needs_input`, `failure`, `done`, `success`, `running`.
- The bridge remains the only runtime hook entrypoint; Raycast should manage JSON files and assets, not become the hook target itself.
- Do not reintroduce a second audio system such as `say`; the product pivot is managed hook sounds, not spoken narration.
- Treat imported sound files as owned assets by copying them into `~/.claude-raycast-notifier/sounds/`.
- If the `writeJson()` helper or path resolution code drifts between hook-side and Raycast-side implementations, fix it immediately before building more UI on top of it.
