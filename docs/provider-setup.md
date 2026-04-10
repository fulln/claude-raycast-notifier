# Provider Setup

This repository now supports a shared hook bridge for Claude, Gemini, and
GitHub Copilot,
but the integration surface is not identical across providers.

## Supported attention moments

- `needs_input`: play sound when user attention is needed
- `done`: play sound when the run completes

The Raycast UI manages these as hook-level mappings, not as a generic sound
library.

## Claude Code

Claude has native hook configuration. Use
[config/claude-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/claude-hooks.example.json)
and point the command path at your local checkout.

This example wires:

- `Elicitation` -> `needs_input`
- `Stop` -> `done`
- `PreToolUse` with matcher `AskUserQuestion` -> interactive Raycast answer handoff

Interactive answer handoff via Raycast is documented separately in
[docs/claude-code-raycast-input-feasibility.md](/Users/fulln/opensource/claude-raycast-notifier/docs/claude-code-raycast-input-feasibility.md).
The repository now ships a dedicated Claude question bridge for this path.

For a local mock roundtrip without opening Raycast, run:

```bash
npm run mock:ask-user-question:auto
```

## Gemini CLI

Gemini CLI has native hooks in `~/.gemini/settings.json`. The local Gemini CLI
docs bundled with the installed package describe hooks under:

- `bundle/docs/hooks/index.md`
- `bundle/docs/hooks/reference.md`
- `bundle/docs/hooks/writing-hooks.md`

Use
[config/gemini-settings.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/gemini-settings.example.json)
as the starting point.

This example wires:

- `BeforeTool` with matcher `ask_user` -> [hooks/gemini-ask-user-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-ask-user-bridge.mjs)
- `Notification` -> `needs_input` via [hooks/gemini-notification-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-notification-bridge.mjs)
- `AfterAgent` -> `done` via [hooks/gemini-after-agent-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-after-agent-bridge.mjs)

Notes:

- Gemini expects hooks in `.gemini/settings.json` or `~/.gemini/settings.json`
- Hook commands receive JSON on `stdin`
- Hook commands must emit only JSON on `stdout`
- The `ask_user` bridge is currently experimental: it routes the prompt through Raycast, then returns the collected answer through Gemini's hook denial channel as structured JSON text

## GitHub Copilot

GitHub Copilot now has official hooks for both cloud agent and CLI workflows.
The current hook surface is session/tool oriented, not semantic in the same
way as Claude and Gemini.

Use
[config/copilot-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/copilot-hooks.example.json)
as the starting point.

This example wires:

- `sessionEnd` with `reason: complete` -> `done` via [hooks/copilot-session-end-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/copilot-session-end-bridge.mjs)

Notes:

- Copilot loads hook config from `.github/hooks/*.json` on the default branch for cloud agent
- Copilot CLI also loads hooks from the current working directory
- There is no first-class `needs_input` hook today, so this repository only maps Copilot `done`

## Antigravity

Antigravity is not wired right now.

As verified locally on April 9, 2026, the installed Antigravity app exposes
agent permissions and auto-approval settings, but I did not find a documented
or local user-configurable shell hook surface equivalent to Claude, Gemini, or
GitHub Copilot hooks. Until that exists, this repository does not advertise
Antigravity support.

## Codex CLI

Codex support is experimental and intentionally minimal.

As verified against the official OpenAI Codex hooks docs on April 10, 2026,
Codex hooks are experimental, currently disabled on Windows, and `PreToolUse`
only supports `Bash`. This repository therefore only wires the documented
minimal path:

- `Stop` -> `done` via [hooks/codex-stop-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/codex-stop-bridge.mjs)
- `PreToolUse` with matcher `Bash` -> risky-command reminder via [hooks/codex-pretool-bash-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/codex-pretool-bash-bridge.mjs)

Manual config example:

- [config/codex-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/codex-hooks.example.json)

Important limitations:

- No Raycast question-answer handoff yet
- No MCP / Write / WebSearch interception through Codex hooks today
- You must also enable the Codex feature flag in `config.toml`:
  - `[features]`
  - `codex_hooks = true`

## Runtime bridge files

- Shared bridge: [hooks/ai-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/ai-event-bridge.mjs)
- Claude wrapper: [hooks/claude-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/claude-event-bridge.mjs)
- Gemini wrapper: [hooks/gemini-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-event-bridge.mjs)
- Gemini notification bridge: [hooks/gemini-notification-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-notification-bridge.mjs)
- Gemini completion bridge: [hooks/gemini-after-agent-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-after-agent-bridge.mjs)
- Copilot completion bridge: [hooks/copilot-session-end-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/copilot-session-end-bridge.mjs)
- Codex completion bridge: [hooks/codex-stop-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/codex-stop-bridge.mjs)
- Codex Bash reminder bridge: [hooks/codex-pretool-bash-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/codex-pretool-bash-bridge.mjs)
