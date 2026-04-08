import { normalizeEvent } from "./lib/event-schema.mjs";
import { readState, writeEvent, writeVoiceMeta } from "./lib/state-store.mjs";
import { triggerRaycast } from "./lib/raycast-deeplink.mjs";
import { showMacNotification } from "./lib/fallback-notifier.mjs";
import { shouldSpeak, speak } from "./lib/voice.mjs";

const STATE_FILE =
  process.env.CLAUDE_NOTIFIER_STATE_FILE ??
  `${process.env.HOME}/.claude-raycast-notifier/state.json`;
const MAX_RECENT = Number(process.env.CLAUDE_NOTIFIER_MAX_RECENT ?? "10");
const VOICE_EVENTS = new Set(
  (process.env.CLAUDE_NOTIFIER_VOICE_EVENTS ?? "needs_input,failure,done").split(","),
);
const VOICE_NAME = process.env.CLAUDE_NOTIFIER_VOICE_NAME ?? "Samantha";
const VOICE_RATE = Number(process.env.CLAUDE_NOTIFIER_VOICE_RATE ?? "190");

const rawInput = await readStdin();
const raw = rawInput ? JSON.parse(rawInput) : {};
const event = normalizeEvent(raw, process.env);
const state = await writeEvent(STATE_FILE, event, MAX_RECENT);

try {
  await triggerRaycast(event);
} catch {
  await showMacNotification(event.title, event.message);
}

if (VOICE_EVENTS.has(event.type)) {
  const text = `${event.title}. ${event.message}`;
  const voiceState = (await readState(STATE_FILE)).voice ?? {
    lastSpokenAt: null,
    lastSpokenText: null,
  };

  if (shouldSpeak(voiceState, text, 15_000)) {
    await speak(text, VOICE_NAME, VOICE_RATE);
    await writeVoiceMeta(STATE_FILE, {
      lastSpokenAt: Date.now(),
      lastSpokenText: text,
    });
  }
}

process.stdout.write(JSON.stringify(state));

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}
