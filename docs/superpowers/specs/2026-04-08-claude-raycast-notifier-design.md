# Claude Raycast Notifier Design

## Overview

Build a small standalone repository that turns `claude-raycast-notifier` into a Raycast-managed sound system for Claude Code hooks. The first version ships with a bundled default sound pack, lets users preview and remap sounds inside Raycast, and keeps the existing notifier UI only as supporting UX for status visibility and actionable Claude events.

This is not a full desktop floating-window app. It is also no longer just a generic notifier. The core product is local hook-to-sound management with a fast install path and clean defaults.

## Goals

- Ship a default Claude hook sound pack that works immediately after install.
- Let users manage per-event sound mappings from Raycast.
- Preserve a small local architecture with no permanent daemon in v1.
- Keep actionable Claude events visible in Raycast when user input is required.
- Support local custom audio imports without forcing users to hand-edit config files.

## Non-Goals

- Building a native floating desktop window in v1.
- Syncing sounds or mappings across machines.
- Hosting a remote sound marketplace or cloud library.
- Supporting arbitrary non-Claude event sources in v1.
- Automatically submitting Raycast choices back into the active Claude session.

## Product Direction

Raycast is the control surface for Claude hook sounds.

The product should feel like this:
- install the repo and get a working default sound experience immediately
- open Raycast to inspect current mappings, preview sounds, and customize them
- keep Claude hook execution local and lightweight
- only foreground Raycast when Claude genuinely needs user input

That means the notification layer becomes supporting UX, while sound management becomes the primary user story.

## Recommended Approach

Use a small Raycast extension plus a local Claude hook bridge script, but center both around a sound-mapping model rather than a notification-first model.

Why this approach:
- It matches the user's real goal: managing Claude hook sounds from Raycast.
- It reuses the existing bridge, state store, and actionable-event UI work already done.
- It keeps runtime simple: Claude hook in, normalized event out, mapped sound playback, optional UI.

Alternatives considered:
1. Keep the repo notification-first and add sound preferences on the side. Faster to describe, but it undershoots the new product goal and makes sound management feel secondary.
2. Build a heavier local controller that fully owns hook installation, asset sync, and automation from day one. More powerful, but too much scope and filesystem/config risk for v1.

## Architecture

```text
Claude Code Hook
  -> local bridge script
  -> normalized event
  -> sound mapping lookup
  -> local sound playback
  -> state JSON update
  -> Raycast Extension
      -> Menu Bar status
      -> sound library + mapping management
      -> actionable foreground UI
```

## Components

### 1. Claude Hook Bridge

A local Node.js script receives Claude Code hook data from configured hook entry points, normalizes incoming payloads, determines the semantic event type, and routes the event to playback and UI.

Input contract for v1:
- Primary input: JSON from `stdin`.
- Secondary metadata: selected environment variables if Claude Code provides them.
- The bridge should not depend on positional CLI arguments in v1.

Responsibilities:
- Read hook-provided input.
- Map raw hook context into a normalized internal event object.
- Derive a stable sound-mapping slot from the raw hook data.
- Load the active sound mapping.
- Play the mapped sound if the slot is enabled.
- Persist current state and bounded event history.
- Wake Raycast only for actionable events such as user-choice or text-input flows.

### 2. Event Normalization Layer

The normalized event model should separate Claude's raw hook shape from the product's sound and UI behavior.

Recommended normalized fields:
- `type`: semantic event type such as `running`, `needs_input`, `success`, `failure`, `done`
- `title`
- `message`
- `severity`
- `timestamp`
- `durationMs`
- `hookEventName`
- `notificationType`
- `action`
- `soundSlot`

`soundSlot` is the important new product field. It should be the stable key used by sound mappings, even if Claude's raw hook families evolve.

### 3. Sound Configuration Store

A local config store defines which sound is mapped to each semantic event slot and where the sound assets live.

Recommended user data location:
- `~/.claude-raycast-notifier/`

Recommended files:
- `state.json` for current/recent runtime state
- `sound-mappings.json` for active event-to-sound configuration
- `sounds/` for copied user-imported assets and installed defaults

Suggested mapping shape:

```json
{
  "version": 1,
  "slots": {
    "needs_input": {
      "soundId": "focus-bell",
      "enabled": true
    },
    "failure": {
      "soundId": "soft-alert",
      "enabled": true
    },
    "done": {
      "soundId": "gentle-finish",
      "enabled": true
    },
    "running": {
      "soundId": null,
      "enabled": false
    }
  }
}
```

The first version should stay simple:
- one sound per slot
- enabled/disabled toggle per slot
- no rule engine
- no layered mixing

### 4. Default Sound Pack

The repository should ship with a bundled default sound pack so the first-run experience works without user setup.

Responsibilities:
- provide a curated set of default audio files in the repo
- assign stable `soundId` values to bundled sounds
- initialize the user's local library and default mappings on first run or repair
- keep the pack small and opinionated in v1

The default pack is part of the product, not sample content.

### 5. User Sound Library

Users should be able to bring their own audio files into the system through Raycast.

Recommended import behavior:
- user selects a local audio file
- the extension copies it into the local notifier sound directory
- the system creates a library entry with a generated id and stored filename
- mappings reference the copied asset, not the source path

Why copy instead of storing absolute paths:
- imported sounds survive moves or renames in the user's original folders
- the notifier owns the assets it depends on
- configuration becomes more portable and less fragile

### 6. Raycast Menu Bar Command

A Raycast Menu Bar command remains useful, but now it serves both runtime visibility and system health.

Responsibilities:
- display the current Claude state at a glance
- show recent events when opened
- show whether sound mappings are installed and readable
- surface any pending actionable event before status/history

The Menu Bar is still persistent status UI, but it is no longer the product centerpiece.

### 7. Raycast Sound Management Views

Raycast should provide dedicated commands or views for sound administration.

Planned responsibilities:
- list semantic event slots and current mapped sounds
- preview bundled or imported sounds
- enable or mute slots
- assign a different sound to a slot
- import a custom sound into the local library
- repair or reinitialize defaults if user data is missing

The extension should make common changes possible without opening JSON files.

### 8. Actionable Event UI

The existing actionable-event work remains valid.

When Claude is waiting on the user:
- Raycast should foreground a focused action-required view
- choice flows should show real options
- input flows should allow text drafting
- the first version still uses copy-and-return behavior instead of direct session submission

This keeps Raycast aligned with its strongest UX role: bringing the user back when Claude needs them.

## Event and Sound Model

The first version should map Claude events into a deliberately small set of semantic slots:

- `needs_input`
- `failure`
- `done`
- `success`
- `running`

These slots should drive both:
- sound mapping behavior
- some UI labeling in Raycast

Claude's lower-level hook names should remain visible for debugging and diagnostics, but the user-facing configuration should prefer semantic slots over raw hook terminology.

Why this matters:
- users care about moments like "Claude failed" or "Claude needs me", not internal hook families
- the config stays stable even if hook payload details change later
- the sound system becomes easier to explain and manage

## Notification and Playback Policy

The new default behavior should be:

- `needs_input`: play mapped sound and foreground Raycast
- `failure`: play mapped sound and use macOS notification
- `done`: play mapped sound and use macOS notification
- `success`: optional sound based on duration threshold or explicit enablement
- `running`: no default sound, status update only

This keeps the system proactive without causing noise or waking Raycast for passive completion messages.

## First-Run and Repair Flow

The product should include a small installation/repair path.

Responsibilities:
- ensure `~/.claude-raycast-notifier/` exists
- install or repair default sound assets if missing
- initialize `sound-mappings.json` if missing
- verify the stable bridge path under `~/.claude/bin/claude-raycast-notifier/`
- verify the user's Claude hooks are pointed at the expected bridge command

The repair flow should be idempotent and safe to run multiple times.

## Repository Structure

The repository should remain at:
- `/Users/fulln/opensource/claude-raycast-notifier`

Recommended structure:

```text
claude-raycast-notifier/
  raycast-extension/
    assets/
      sounds/
    src/
      menu-bar-status.tsx
      notify-event.tsx
      manage-sounds.tsx
      sound-library.tsx
      lib/
  hooks/
    claude-event-bridge.mjs
    lib/
      event-schema.mjs
      playback.mjs
      sound-config.mjs
      state-store.mjs
  config/
    claude-hooks.example.json
  docs/
    superpowers/specs/
      2026-04-08-claude-raycast-notifier-design.md
```

This keeps the existing split, but adds a dedicated sound-management layer instead of burying audio logic in notification code.

## Error Handling and Fallbacks

The system should degrade gracefully:

- If sound playback fails, the bridge should still write state and continue UI routing.
- If a mapped sound file is missing, the system should fall back to silence or a known default and record the problem in state.
- If state writes fail, immediate playback and actionable routing should still proceed.
- If Raycast-triggered UI is unavailable, actionable events should still remain visible through macOS notification.
- If the config store is missing or invalid, the extension should offer repair instead of crashing.

## Testing Strategy

Testing for v1 should stay practical and local.

### Bridge verification

Test the bridge with fixed sample payloads to confirm:
- raw hook input is parsed correctly
- normalized events produce the correct `soundSlot`
- state updates are correct
- playback lookup chooses the expected sound id
- actionable events still route to Raycast while passive ones do not

### Config verification

Test that:
- default mappings initialize correctly
- missing config files can be repaired
- imported sound metadata is stored correctly
- invalid mapping entries fail safely

### Raycast verification

Manually verify:
- the Menu Bar shows current status and actionable events
- sound management views display mappings and bundled sounds
- preview actions play the right audio
- importing a custom sound makes it available for assignment
- changing a slot mapping changes the next real hook playback

### Mock event verification

Provide local mock commands for at least:
- `needs_input`
- `failure`
- `done`

These should be usable both for runtime behavior checks and for confirming mapping changes without waiting on real Claude traffic.

## Why No Full Desktop Floating Window in v1

A true always-on-top floating desktop note layer would require a different app model and significantly larger scope. The current product goal is better served by a local hook bridge plus Raycast-managed sound controls. Raycast already gives a fast command surface, Menu Bar presence, and lightweight UI for configuration.

## Future Evolution

If v1 works well, later versions can add:
- multiple bundled sound packs
- richer per-slot playback options such as volume or cooldown
- export/import of user mapping presets
- better hook installation automation from inside Raycast
- a dedicated floating desktop UI that reuses the same normalized event and sound-slot model

## Initial Success Criteria

The first version is successful if it can:
- install with a working default Claude hook sound experience
- normalize Claude hook events into stable semantic sound slots
- let the user inspect and change sound mappings from Raycast
- let the user import custom local sounds safely
- play the expected sound when real Claude hooks fire
- preserve actionable Raycast UI only for user-input-required events
- avoid noisy or fragile configuration behavior
