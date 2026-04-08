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
    action,
    soundSlot: deriveSoundSlot(type, hookEventName),
  };
}

export function deriveSoundSlot(type, hookEventName) {
  if (hookEventName === "Elicitation" || type === "needs_input") return "needs_input";
  if (type === "failure") return "failure";
  if (type === "done") return "done";
  if (type === "success") return "success";
  return "running";
}

export function isActionableEvent(event) {
  return event.action !== null || event.type === "needs_input";
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

  if (
    hookEventName === "Elicitation" &&
    (placeholder !== undefined || type === "needs_input")
  ) {
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
