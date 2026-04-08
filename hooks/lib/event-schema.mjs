const DEFAULT_SEVERITY = {
  running: "info",
  needs_input: "warning",
  success: "info",
  failure: "error",
  done: "info",
};

export function normalizeEvent(raw = {}, env = process.env) {
  const type = raw.type ?? env.CLAUDE_HOOK_EVENT_TYPE ?? "running";
  const title = raw.title ?? defaultTitle(type);
  const message = raw.message ?? raw.summary ?? "Claude event received";

  return {
    type,
    title,
    message,
    severity: raw.severity ?? DEFAULT_SEVERITY[type] ?? "info",
    timestamp: raw.timestamp ?? new Date().toISOString(),
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : null,
  };
}

function defaultTitle(type) {
  if (type === "needs_input") return "Claude needs your input";
  if (type === "failure") return "Claude hit an error";
  if (type === "done") return "Claude finished the task";
  if (type === "success") return "Claude completed the command";
  return "Claude is working";
}
