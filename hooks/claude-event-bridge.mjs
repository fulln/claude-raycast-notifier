import { isActionableEvent, normalizeEvent } from "./lib/event-schema.mjs";
import { writeEvent } from "./lib/state-store.mjs";
import { triggerRaycast } from "./lib/raycast-deeplink.mjs";
import { showMacNotification } from "./lib/fallback-notifier.mjs";
import { playSoundForEvent } from "./lib/playback.mjs";
import { ensureUserData, defaultRootDir } from "./lib/sound-config.mjs";

const MAX_RECENT = Number(process.env.CLAUDE_NOTIFIER_MAX_RECENT ?? "10");
const rootDir = defaultRootDir();
const { paths } = await ensureUserData({ rootDir });
const STATE_FILE = process.env.CLAUDE_NOTIFIER_STATE_FILE ?? paths.stateFile;

const rawInput = await readStdin();
const raw = rawInput ? JSON.parse(rawInput) : {};
const event = normalizeEvent(raw, process.env);
const playback = await playSoundForEvent(event, { rootDir: paths.rootDir });
const state = await writeEvent(STATE_FILE, event, MAX_RECENT, {
  lastPlayedAt: playback.played ? playback.playedAt : null,
  lastPlayedSoundId: playback.played ? playback.soundId : null,
  lastSlot: playback.slot ?? event.soundSlot ?? null,
  lastError: playback.error ?? playback.reason,
});

if (isActionableEvent(event)) {
  try {
    await triggerRaycast(event);
  } catch {
    await showMacNotification(event.title, event.message);
  }
} else {
  await showMacNotification(event.title, event.message);
}

process.stdout.write(JSON.stringify({ current: state.current, playback }));

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}
