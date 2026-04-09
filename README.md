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
- GitHub Copilot (`Done` only)

It intentionally does not ship Codex integration until Codex exposes native hooks.
It also does not currently ship Antigravity integration because Antigravity does
not expose a stable external hook surface that this project can target.

## Install

Requirements:

- macOS
- Raycast app already installed
- Node.js and `npm`

One-command install:

```bash
curl -fsSL https://raw.githubusercontent.com/fulln/claude-raycast-notifier/main/scripts/bootstrap.sh | bash
```

This will:

- download a small bootstrap script
- download the latest release bundle
- install it into `~/.ai-hook-notifier`
- back up and merge Claude / Gemini hook settings
- install Raycast extension dependencies
- start the extension in the background
- open Raycast

After Raycast opens:

1. Run `Manage Hook Sounds`
2. Confirm `Needs Input` and `Done` are configured

If you ever need to start the extension again manually:

```bash
cd ~/.ai-hook-notifier/raycast-extension
npm run dev -- --non-interactive --exit-on-error
```

<details>
<summary>AI-Friendly Install Prompt</summary>

If another AI assistant is helping with setup, tell it:

```text
Install AI Hook Notifier with:
curl -fsSL https://raw.githubusercontent.com/fulln/claude-raycast-notifier/main/scripts/bootstrap.sh | bash

Do not replace the entire Claude or Gemini settings file.
Only merge the required hooks configuration.

If the extension needs to be started manually, use:
cd ~/.ai-hook-notifier/raycast-extension && npm run dev -- --non-interactive --exit-on-error
```

</details>

## Provider Setup

### Claude Code

The installer writes Claude hooks automatically.

If you want to configure them manually, use:
- [config/claude-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/claude-hooks.example.json)

Mapping:
- `Elicitation` -> `Needs Input`
- `Stop` -> `Done`

### Gemini CLI

The installer writes Gemini hooks automatically.

If you want to configure them manually, use:
- [config/gemini-settings.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/gemini-settings.example.json)

Mapping:
- `Notification` -> `Needs Input`
- `AfterAgent` -> `Done`

### GitHub Copilot

Copilot has official hooks, but they are session-oriented.

If you want to configure them manually, use:
- [config/copilot-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/copilot-hooks.example.json)

Mapping:
- `sessionEnd` with `reason: complete` -> `Done`

Current limitation:
- Copilot does not expose a first-class `Needs Input` hook in the documented hook surface, so this repository only maps `Done`

## What it does

- Plays a sound when the AI needs your input
- Plays a sound when the AI finishes
- Shows a compact macOS notification
- Keeps the notification content minimal: provider + `Needs Input` / `Done`

## Raycast commands

- `Manage Hook Sounds`: configure the two semantic sounds
- `Notify AI Event`: internal callback command used by the hook bridges

## Sounds

Open `Manage Hook Sounds` in Raycast and set:

- `Needs Input`
- `Done`

The repository now bundles the default Claude sounds:

- [raycast-extension/assets/sounds/readytowork.mp3](/Users/fulln/opensource/claude-raycast-notifier/raycast-extension/assets/sounds/readytowork.mp3)
- [raycast-extension/assets/sounds/jobs_done.mp3](/Users/fulln/opensource/claude-raycast-notifier/raycast-extension/assets/sounds/jobs_done.mp3)

## Development

Run the checks locally:

```bash
npm test
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
