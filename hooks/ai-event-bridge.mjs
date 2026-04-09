import {
  normalizeEvent,
  shouldNotifyEvent,
} from "./lib/event-schema.mjs";
import { writeEvent } from "./lib/state-store.mjs";
import { triggerRaycast } from "./lib/raycast-deeplink.mjs";
import { showMacNotification } from "./lib/fallback-notifier.mjs";
import { playSoundForEvent } from "./lib/playback.mjs";
import { ensureUserData, defaultRootDir } from "./lib/sound-config.mjs";

export async function main({ source } = {}) {
  const MAX_RECENT = Number(process.env.CLAUDE_NOTIFIER_MAX_RECENT ?? "10");
  const rootDir = defaultRootDir();
  const { paths } = await ensureUserData({ rootDir });
  const STATE_FILE = process.env.CLAUDE_NOTIFIER_STATE_FILE ?? paths.stateFile;

  const rawInput = await readStdin();
  const raw = rawInput ? JSON.parse(rawInput) : {};

  return runEventBridge({
    source,
    raw,
    rootDir: paths.rootDir,
    stateFile: STATE_FILE,
    maxRecent: MAX_RECENT,
  });
}

export async function runEventBridge({
  source,
  raw = {},
  rootDir = defaultRootDir(),
  stateFile,
  maxRecent = Number(process.env.CLAUDE_NOTIFIER_MAX_RECENT ?? "10"),
} = {}) {
  const { paths } = await ensureUserData({ rootDir });
  const resolvedStateFile = stateFile ?? paths.stateFile;
  const event = normalizeEvent(
    source ? { ...raw, source } : raw,
    source ? { ...process.env, AI_NOTIFIER_SOURCE: source } : process.env,
  );

  const shouldNotify = shouldNotifyEvent(event);
  const playback = shouldNotify
    ? await playSoundForEvent(event, { rootDir: paths.rootDir })
    : {
        slot: event.soundSlot ?? event.type ?? "running",
        hookKey: event.hookKey ?? null,
        soundId: null,
        filePath: null,
        reason: "skipped",
        played: false,
        playedAt: null,
        error: null,
      };

  const state = await writeEvent(resolvedStateFile, event, maxRecent, {
    lastPlayedAt: playback.played ? playback.playedAt : null,
    lastPlayedSoundId: playback.played ? playback.soundId : null,
    lastSlot: playback.slot ?? event.soundSlot ?? null,
    lastError: playback.error ?? playback.reason,
  });

  if (shouldNotify) {
    try {
      await triggerRaycast(event);
    } catch {
      await showMacNotification(event.title, event.message);
    }
  }

  process.stdout.write(JSON.stringify({ current: state.current, playback }));
  return { current: state.current, playback };
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
