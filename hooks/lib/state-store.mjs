import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function defaultState() {
  return {
    current: null,
    recent: [],
    voice: { lastSpokenAt: null, lastSpokenText: null },
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

export async function writeVoiceMeta(filePath, voice) {
  const state = await readState(filePath);
  const next = { ...state, voice };
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}
