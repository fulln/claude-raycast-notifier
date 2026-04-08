# Claude Raycast Notifier Design

## Overview

Build a small standalone repository that connects Claude Code hooks to Raycast so Claude can notify the user more proactively through Raycast Toast/HUD, a Menu Bar status view, and macOS voice. This is not a full desktop floating-window app. The first version focuses on high-signal Claude Code status notifications.

## Goals

- Turn Claude Code hook events into visible, proactive desktop feedback.
- Support customizable notifications through Raycast Toast/HUD.
- Show persistent current status in a Raycast Menu Bar command.
- Add optional macOS voice for important events.
- Keep the system small and local, without introducing a background server for v1.

## Non-Goals

- Building a native floating desktop window in v1.
- Building a general-purpose system notification center.
- Supporting non-Claude event sources in v1.
- Introducing a permanent local daemon or event bus in v1.

## Recommended Approach

Use a small Raycast extension plus a local Claude hook bridge script.

Why this approach:
- It gives the desired experience with the least moving parts.
- It preserves a clean separation between event generation and presentation.
- It can evolve later into a richer UI without changing the Claude hook contract.

Alternatives considered:
1. Hooks directly calling notifications and `say` with no extension. Faster initially, but weak persistence and poor state visibility.
2. A heavier local gateway service. More extensible, but unnecessary complexity for the first version.

## Architecture

```text
Claude Code Hook
  → local bridge script
  → event/state JSON
  → Raycast Extension
      → Toast / HUD
      → Menu Bar status
      → macOS say voice
```

### Components

#### 1. Claude Hook Bridge
A local Node.js script receives Claude Code hook data from the configured hook entry points. It normalizes incoming event payloads into a small internal event schema.

Input contract for v1:
- Primary input: JSON from `stdin`.
- Secondary metadata: selected environment variables if Claude Code provides them.
- The bridge should not depend on positional CLI arguments in v1.

Responsibilities:
- Read hook-provided input.
- Map raw hook context into a normalized event object.
- Persist latest state and bounded event history.
- Trigger the notification path for high-priority events.

#### 2. State Store
A local JSON state file stores the current Claude status and a short recent history.

Recommended location:
- `~/.claude-raycast-notifier/state.json`

Suggested shape:

```json
{
  "current": {
    "type": "running",
    "title": "Claude is working",
    "message": "Running tests",
    "severity": "info",
    "timestamp": "2026-04-08T10:00:00Z"
  },
  "recent": []
}
```

The bridge should keep only the most recent N events so the file stays small and fast.

#### 3. Raycast Menu Bar Command
A Raycast Menu Bar command reads the state file and renders the current Claude status, with access to recent events. This provides persistence beyond one-off notifications.

Refresh strategy for v1:
- The Menu Bar command should read `state.json` on render/open.
- It may also refresh on a short polling interval if Raycast command capabilities allow it cleanly.
- The state file remains the source of truth; notifications should not be the source of current status.

Responsibilities:
- Display current state at a glance.
- Show recent events when opened.
- Reflect severity through icon/text state.

#### 4. Raycast Notify Command
A Raycast-triggered notification path displays Toast/HUD for selected events.

Trigger path for v1:
- The bridge should invoke Raycast through a stable local trigger path such as the Raycast CLI or a script command entry point.
- Deeplinks can be kept as a fallback, but should not be the primary mechanism in v1 because they are less explicit for local automation.

Responsibilities:
- Render high-value notifications.
- Respect per-event configuration.
- Avoid noisy behavior on low-value events.

#### 5. Voice Layer
The system uses macOS `say` for spoken feedback on important events.

Responsibilities:
- Speak only for selected event types.
- Support configuration for voice, rate, and on/off.
- Apply throttling so rapid event bursts do not stack speech.

## Event Model

The first version should support a deliberately small set of high-signal events:

- `running`: Claude started a meaningful operation.
- `needs_input`: Claude is waiting for user confirmation or input.
- `success`: A meaningful command finished successfully.
- `failure`: A command or task failed.
- `done`: Claude finished the task or unit of work.

Suggested normalized event format:

```json
{
  "type": "needs_input",
  "title": "Claude needs your input",
  "message": "Approve the command in Claude Code",
  "severity": "warning",
  "timestamp": "2026-04-08T10:00:00Z"
}
```

## Notification Policy

To avoid fatigue, the first version should notify selectively:

- `running`: update Menu Bar; no default voice.
- `needs_input`: Toast/HUD + voice.
- `success`: notify only if operation duration exceeds a configured threshold.
- `failure`: Toast/HUD + voice.
- `done`: Toast/HUD + short voice.

This keeps the system proactive without becoming noisy.

## Customization

The user explicitly wants customizable notifications and voice integration. The design should support these preferences through Raycast extension preferences and simple bridge config.

Configuration should cover:
- Which event types produce Toast/HUD.
- Which event types trigger voice.
- Voice name and speaking rate.
- Success notification duration threshold.
- Maximum recent event count.
- Preferred wording for spoken messages.

## Repository Structure

The repository should live at:
- `/Users/fulln/opensource/claude-raycast-notifier`

Suggested structure:

```text
claude-raycast-notifier/
  raycast-extension/
    src/
      menu-bar-status.tsx
      notify.tsx
      preferences.ts
  hooks/
    claude-event-bridge.js
  config/
    claude-hooks.example.json
  docs/
    superpowers/specs/
      2026-04-08-claude-raycast-notifier-design.md
```

This should be a standalone repository because Raycast extensions have their own packaging and development workflow, and the bridge/UI split is already beyond a single throwaway script.

## Error Handling and Fallbacks

The system should degrade gracefully:

- If state write fails, the bridge should still attempt immediate notification.
- If Raycast-triggered notification is unavailable, the system should fall back to macOS notification and optional `say`.
- If voice is enabled, repeated events should be throttled to prevent overlapping speech.
- If the state file is missing or invalid, the Menu Bar command should show a safe idle/error state instead of crashing.

## Testing Strategy

Testing for v1 should stay practical:

### Manual simulation
Provide a mock event command to simulate:
- `needs_input`
- `failure`
- `done`

### Bridge verification
Test the bridge with fixed sample input payloads to confirm:
- raw hook input is parsed correctly
- normalized events are correct
- state file updates are correct
- history trimming works

### Raycast verification
Manually verify:
- Menu Bar status updates correctly
- Toast/HUD appears for targeted events
- voice triggers only for configured event types
- throttling prevents repeated speech spam

## Why No Full Desktop Floating Window in v1

A true always-on-top floating desktop note layer would likely require a separate native or Electron/Tauri-style desktop app. That adds a different UI/runtime model and significantly expands scope. Since the immediate goal is proactive Claude Code notifications with customization and voice, Raycast is enough for the first version and keeps the feedback loop fast.

## Future Evolution

If v1 works well, later versions can add:
- richer event history
- actionable notifications
- multi-source events beyond Claude Code
- a dedicated floating desktop UI that reuses the same normalized event/state contract

## Initial Success Criteria

The first version is successful if it can:
- receive Claude Code hook events locally
- normalize them into a consistent schema
- show current Claude state in Raycast Menu Bar
- trigger customizable Toast/HUD for key events
- speak selected events through macOS voice
- avoid excessive notification noise
