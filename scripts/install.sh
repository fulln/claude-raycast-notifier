#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="${HOME}/.claude"
GEMINI_DIR="${HOME}/.gemini"
CODEX_DIR="${HOME}/.codex"
NOTIFIER_DIR="${HOME}/.claude-raycast-notifier"
CLAUDE_SETTINGS="${CLAUDE_DIR}/settings.json"
GEMINI_SETTINGS="${GEMINI_DIR}/settings.json"
CODEX_HOOKS="${CODEX_DIR}/hooks.json"
CODEX_CONFIG="${CODEX_DIR}/config.toml"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
PLATFORM_MODE="${AI_HOOK_NOTIFIER_PLATFORM_MODE:-full}"

echo "Installing AI Hook Notifier from: ${REPO_ROOT}"
echo "Platform mode: ${PLATFORM_MODE}"

mkdir -p "${CLAUDE_DIR}/backups" "${GEMINI_DIR}/backups" "${CODEX_DIR}/backups"

if [ -f "${CLAUDE_SETTINGS}" ]; then
  cp "${CLAUDE_SETTINGS}" "${CLAUDE_DIR}/backups/settings.json.${TIMESTAMP}"
  echo "Backed up existing Claude settings"
fi

if [ -f "${GEMINI_SETTINGS}" ]; then
  cp "${GEMINI_SETTINGS}" "${GEMINI_DIR}/backups/settings.json.${TIMESTAMP}"
  echo "Backed up existing Gemini settings"
fi

if [ -f "${CODEX_HOOKS}" ]; then
  cp "${CODEX_HOOKS}" "${CODEX_DIR}/backups/hooks.json.${TIMESTAMP}"
  echo "Backed up existing Codex hooks"
fi

if [ -f "${CODEX_CONFIG}" ]; then
  cp "${CODEX_CONFIG}" "${CODEX_DIR}/backups/config.toml.${TIMESTAMP}"
  echo "Backed up existing Codex config"
fi

merge_settings() {
  local target_path="$1"
  local template_path="$2"

  TARGET_PATH="${target_path}" TEMPLATE_PATH="${template_path}" REPO_ROOT="${REPO_ROOT}" node <<'NODE'
const fs = require("fs");

const targetPath = process.env.TARGET_PATH;
const templatePath = process.env.TEMPLATE_PATH;
const repoRoot = process.env.REPO_ROOT;

function readJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

const current = readJson(targetPath, {});
const templateRaw = fs
  .readFileSync(templatePath, "utf8")
  .replaceAll("/Users/fulln/.claude/bin/claude-raycast-notifier", repoRoot);
const template = JSON.parse(templateRaw);

const merged = {
  ...current,
  ...template,
  hooks: {
    ...(current.hooks ?? {}),
    ...(template.hooks ?? {}),
  },
};

fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n");
NODE
}

merge_settings "${CLAUDE_SETTINGS}" "${REPO_ROOT}/config/claude-hooks.example.json"
merge_settings "${GEMINI_SETTINGS}" "${REPO_ROOT}/config/gemini-settings.example.json"
merge_settings "${CODEX_HOOKS}" "${REPO_ROOT}/config/codex-hooks.example.json"

CODEX_CONFIG_PATH="${CODEX_CONFIG}" node <<'NODE'
const fs = require("fs");
const path = process.env.CODEX_CONFIG_PATH;

fs.mkdirSync(require("path").dirname(path), { recursive: true });
let current = "";
try {
  current = fs.readFileSync(path, "utf8");
} catch {}

if (!current.includes("codex_hooks = true")) {
  const trimmed = current.trimEnd();
  const next =
    trimmed.length === 0
      ? "[features]\ncodex_hooks = true\n"
      : /\[features\]/.test(trimmed)
        ? `${trimmed}\ncodex_hooks = true\n`
        : `${trimmed}\n\n[features]\ncodex_hooks = true\n`;
  fs.writeFileSync(path, next);
}
NODE

echo "Installed Claude hook config to ${CLAUDE_SETTINGS}"
echo "Installed Gemini hook config to ${GEMINI_SETTINGS}"
echo "Installed Codex hook config to ${CODEX_HOOKS}"
echo "Enabled Codex hooks feature in ${CODEX_CONFIG}"

has_raycast() {
  open -Ra Raycast >/dev/null 2>&1
}

LOG_DIR="${NOTIFIER_DIR}"
LOG_FILE="${LOG_DIR}/raycast-develop.log"
mkdir -p "${LOG_DIR}"

echo
echo "Install complete."
echo "Claude hook config: ${CLAUDE_SETTINGS}"
echo "Gemini hook config: ${GEMINI_SETTINGS}"
echo "Codex hook config: ${CODEX_HOOKS}"
echo "Codex config: ${CODEX_CONFIG}"
echo "Notifier data directory: ${NOTIFIER_DIR}"

if [ "${PLATFORM_MODE}" != "full" ]; then
  echo
  echo "Hook-only mode is active."
  echo "Claude, Gemini, and Codex hooks were installed."
  echo "Raycast UI and extension startup are only supported on macOS."
  exit 0
fi

if has_raycast; then
  if ! command -v npm >/dev/null 2>&1; then
    echo
    echo "Raycast is installed, but npm is missing."
    echo "Install Node.js + npm, then run:"
    echo "  cd ${REPO_ROOT}/raycast-extension && npm install && npm run dev -- --non-interactive --exit-on-error"
    exit 0
  fi

  cd "${REPO_ROOT}/raycast-extension"
  npm install

  if pgrep -f "ray develop --non-interactive --exit-on-error" >/dev/null 2>&1; then
    echo "Raycast develop session already running"
  else
    nohup npm run dev -- --non-interactive --exit-on-error >"${LOG_FILE}" 2>&1 &
    echo "Started Raycast develop session in background"
    echo "Log file: ${LOG_FILE}"
  fi

  open -a Raycast || true

  echo
  echo "Raycast was detected, so sound management is available in the app."
  echo "Next steps:"
  echo "1. Wait a few seconds for Raycast to load the extension"
  echo "2. Open Raycast and run: Manage Hook Sounds"
  echo "3. Confirm Needs Input and Done are configured for Claude, Gemini, and Codex"
else
  echo
  echo "Raycast is not installed."
  echo "Voice notifications are already enabled through Claude/Gemini/Codex hooks."
  echo "You can install Raycast later on macOS to manage sounds visually."
fi
