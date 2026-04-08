import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function shouldSpeak(voiceState, text, cooldownMs, now = Date.now()) {
  if (!voiceState.lastSpokenAt || voiceState.lastSpokenText !== text) return true;
  return now - voiceState.lastSpokenAt >= cooldownMs;
}

export async function speak(text, voiceName = "Samantha", rate = 190) {
  await execFileAsync("say", ["-v", voiceName, "-r", String(rate), text]);
}
