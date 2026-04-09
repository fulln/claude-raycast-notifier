# Provider Setup

This repository now supports a shared hook bridge for Claude and Gemini,
but the integration surface is not identical across providers.

## Supported attention moments

- `needs_input`: play sound and foreground Raycast when user attention is needed
- `done`: play sound and foreground Raycast when the run completes

The Raycast UI manages these as hook-level mappings, not as a generic sound
library.

## Claude Code

Claude has native hook configuration. Use
[config/claude-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/claude-hooks.example.json)
and point the command path at your local checkout.

This example wires:

- `Elicitation` -> `needs_input`
- `Stop` -> `done`

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

- `Notification` -> `needs_input` via [hooks/gemini-notification-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-notification-bridge.mjs)
- `AfterAgent` -> `done` via [hooks/gemini-after-agent-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-after-agent-bridge.mjs)

Notes:

- Gemini expects hooks in `.gemini/settings.json` or `~/.gemini/settings.json`
- Hook commands receive JSON on `stdin`
- Hook commands must emit only JSON on `stdout`

## Codex CLI

Codex support is intentionally not shipped right now.

As verified locally on April 9, 2026 against `codex-cli 0.118.0`, Codex CLI
still exposes no native hook configuration. Until upstream hooks exist, this
repository does not wire Codex events into the shared notifier flow.

## Runtime bridge files

- Shared bridge: [hooks/ai-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/ai-event-bridge.mjs)
- Claude wrapper: [hooks/claude-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/claude-event-bridge.mjs)
- Gemini wrapper: [hooks/gemini-event-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-event-bridge.mjs)
- Gemini notification bridge: [hooks/gemini-notification-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-notification-bridge.mjs)
- Gemini completion bridge: [hooks/gemini-after-agent-bridge.mjs](/Users/fulln/opensource/claude-raycast-notifier/hooks/gemini-after-agent-bridge.mjs)
