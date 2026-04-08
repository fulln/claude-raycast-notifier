import { getPreferenceValues } from "@raycast/api";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";

export type ClaudeEvent = {
  type: "running" | "needs_input" | "success" | "failure" | "done";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: string;
  durationMs: number | null;
};

export type NotifierState = {
  current: ClaudeEvent | null;
  recent: ClaudeEvent[];
};

type Preferences = { stateFilePath: string };

export async function loadState(): Promise<NotifierState> {
  const prefs = getPreferenceValues<Preferences>();
  const path = prefs.stateFilePath.replace(/^~(?=\/)/, homedir());

  try {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw) as NotifierState;
  } catch {
    return { current: null, recent: [] };
  }
}
