# AI Hook Notifier

Raycast-based sound and notification bridge for AI CLI hooks.

Today this repository supports:

- Claude Code
- Gemini CLI

It intentionally does not ship Codex integration until Codex exposes native hooks.

## What it does

- Plays a sound when the AI needs your input
- Plays a sound when the AI finishes
- Opens a compact Raycast notification command
- Keeps the notification content minimal: provider + `Needs Input` / `Done`

## Raycast commands

- `Manage Hook Sounds`: configure the two semantic sounds
- `Notify AI Event`: internal callback command used by the hook bridges

## Setup

### 1. Install the Raycast extension locally

```bash
cd raycast-extension
npm install
ray develop
```

### 2. Configure Claude hooks

Use [config/claude-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/claude-hooks.example.json) as the template for `~/.claude/settings.json`.

Hook mapping:

- `Elicitation` -> `Needs Input`
- `Stop` -> `Done`

### 3. Configure Gemini hooks

Use [config/gemini-settings.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/gemini-settings.example.json) as the template for `~/.gemini/settings.json`.

Hook mapping:

- `Notification` -> `Needs Input`
- `AfterAgent` -> `Done`

### 4. Choose sounds

Open `Manage Hook Sounds` in Raycast and set:

- `Needs Input`
- `Done`

The repository now bundles the default Claude sounds:

- [raycast-extension/assets/sounds/readytowork.mp3](/Users/fulln/opensource/claude-raycast-notifier/raycast-extension/assets/sounds/readytowork.mp3)
- [raycast-extension/assets/sounds/jobs_done.mp3](/Users/fulln/opensource/claude-raycast-notifier/raycast-extension/assets/sounds/jobs_done.mp3)

## Development

Run the checks locally:

```bash
npm run test:hooks
npm --prefix raycast-extension run lint
npm --prefix raycast-extension run build
```

## Release

Local release flow:

```bash
npm run release -- patch "release notes"
npm run release:tag
git push origin main --follow-tags
```

GitHub automation:

- CI runs on pushes to `main` and pull requests
- GitHub Release runs when a `v*.*.*` tag is pushed
- The workflow rebuilds the extension and uploads a zip artifact
