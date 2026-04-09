# AI Hook Notifier

[![Downloads](https://img.shields.io/github/downloads/fulln/claude-raycast-notifier/total?style=flat-square&label=downloads)](https://github.com/fulln/claude-raycast-notifier/releases)
[![Raycast Extension](https://img.shields.io/badge/Raycast-Extension-FF6363?style=flat-square&logo=raycast&logoColor=white)](https://www.raycast.com/)
[![GitHub Stars](https://img.shields.io/github/stars/fulln/claude-raycast-notifier?style=flat-square&label=stars)](https://github.com/fulln/claude-raycast-notifier/stargazers)

Raycast-based sound and notification bridge for AI CLI hooks.

The public product name is `AI Hook Notifier`.
The repository slug still uses the older `claude-raycast-notifier` name for compatibility with the current Raycast extension id and existing deeplink wiring.

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

### One-Command Install

Remote bootstrap:

```bash
curl -fsSL https://raw.githubusercontent.com/fulln/claude-raycast-notifier/main/scripts/bootstrap.sh | bash
```

This downloads the latest release bundle into `~/.ai-hook-notifier` by default, then runs the local installer.

If you already cloned the repository yourself, use:

```bash
./scripts/install.sh
```

This will:

- install `raycast-extension` dependencies
- back up existing Claude and Gemini settings
- write hook configs that point at your local checkout

After that, start the extension:

```bash
cd raycast-extension
ray develop
```

### Manual Install

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

GitHub automation:

- CI runs on pushes to `main` and pull requests
- GitHub Release now runs on every push to `main`
- Each release version is generated automatically as `vYYYY.M.N`
- `YYYY.M` is the current UTC year and month
- `N` auto-increments within the same month
- The workflow rebuilds the extension, creates a tag, and uploads a zip artifact

## Raycast Store

Public store publishing stays semi-automatic because Raycast's official flow is:

- run `npm run publish` inside the extension directory
- authenticate with GitHub
- let Raycast open or update a PR in `raycast/extensions`
- wait for Raycast review and merge

This repository wraps that as:

```bash
npm run publish:store
```

That command is local on purpose. It is not wired to GitHub Actions because the public store flow still depends on Raycast's publish CLI and review process.

## Release Assets

Each GitHub Release now publishes:

- `claude-raycast-notifier-vYYYY.M.N.zip`
  The built Raycast extension artifact
- `ai-hook-notifier-bundle-vYYYY.M.N.zip`
  A full install bundle with hooks, config, installer scripts, and the Raycast extension
