# AI Hook Notifier

Play focused sounds for AI CLI hook events in Raycast.

Supported providers:

- Claude Code
- Gemini CLI

Current semantic notifications:

- `Needs Input`
- `Done`

## What It Does

- Plays a sound when the AI needs your attention
- Plays a sound when the AI finishes
- Opens a compact Raycast notification
- Keeps notification text minimal: provider + status

## Commands

- `Manage Hook Sounds`
  Configure the two semantic sounds: `Needs Input` and `Done`
- `Notify AI Event`
  Internal callback command used by the hook bridge scripts

## Default Sounds

The extension ships with bundled defaults:

- `Claude Ready To Work`
- `Claude Jobs Done`

You can change them at any time from `Manage Hook Sounds`.

## Setup

### Quick Install

Requirements:

- Raycast app already installed
- Node.js and `npm`

Install with:

```bash
AI_HOOK_NOTIFIER_DIR="${HOME}/.ai-hook-notifier"; TMP_DIR="$(mktemp -d)"; ASSET_URL="$(curl -fsSL https://api.github.com/repos/fulln/claude-raycast-notifier/releases/latest | python3 -c 'import json,sys; assets=json.load(sys.stdin).get("assets", []); print(next(asset["browser_download_url"] for asset in assets if "ai-hook-notifier-bundle-" in asset.get("browser_download_url","") and asset["browser_download_url"].endswith(".zip")))' )"; curl -fL "$ASSET_URL" -o "$TMP_DIR/bundle.zip"; rm -rf "$AI_HOOK_NOTIFIER_DIR"; mkdir -p "$AI_HOOK_NOTIFIER_DIR"; unzip -q "$TMP_DIR/bundle.zip" -d "$AI_HOOK_NOTIFIER_DIR"; bash "$AI_HOOK_NOTIFIER_DIR/scripts/install.sh"; rm -rf "$TMP_DIR"
```

This downloads the latest install bundle release and installs it into `~/.ai-hook-notifier`.
It also backs up your current Claude and Gemini settings, then merges in the required hook entries.

The installer starts the extension for you.
If you ever need to start it manually:

```bash
cd ~/.ai-hook-notifier/raycast-extension
npm run dev -- --non-interactive --exit-on-error
```

### Claude Code

Configure Claude hooks so:

- `Elicitation` maps to `Needs Input`
- `Stop` maps to `Done`

Example config:
- [config/claude-hooks.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/claude-hooks.example.json)

### Gemini CLI

Configure Gemini hooks so:

- `Notification` maps to `Needs Input`
- `AfterAgent` maps to `Done`

Example config:
- [config/gemini-settings.example.json](/Users/fulln/opensource/claude-raycast-notifier/config/gemini-settings.example.json)

## Notes

- Codex is intentionally not wired yet because it does not currently expose stable native hooks for this flow.
- The extension stores managed sound data under `~/.claude-raycast-notifier` by default.
