export type ClaudeEvent = {
  type: "running" | "needs_input" | "success" | "failure" | "done";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: string;
  durationMs: number | null;
};

export function decodePayload(payload: string): ClaudeEvent {
  const json = Buffer.from(payload, "base64").toString("utf8");
  return JSON.parse(json) as ClaudeEvent;
}
