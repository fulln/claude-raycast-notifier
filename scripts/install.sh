#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="${HOME}/.claude"
GEMINI_DIR="${HOME}/.gemini"
CLAUDE_SETTINGS="${CLAUDE_DIR}/settings.json"
GEMINI_SETTINGS="${GEMINI_DIR}/settings.json"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

echo "Installing AI Hook Notifier from: ${REPO_ROOT}"

mkdir -p "${CLAUDE_DIR}/backups" "${GEMINI_DIR}/backups"

if [ -f "${CLAUDE_SETTINGS}" ]; then
  cp "${CLAUDE_SETTINGS}" "${CLAUDE_DIR}/backups/settings.json.${TIMESTAMP}"
  echo "Backed up existing Claude settings"
fi

if [ -f "${GEMINI_SETTINGS}" ]; then
  cp "${GEMINI_SETTINGS}" "${GEMINI_DIR}/backups/settings.json.${TIMESTAMP}"
  echo "Backed up existing Gemini settings"
fi

sed "s|/Users/fulln/.claude/bin/claude-raycast-notifier|${REPO_ROOT}|g" \
  "${REPO_ROOT}/config/claude-hooks.example.json" > "${CLAUDE_SETTINGS}"

sed "s|/Users/fulln/.claude/bin/claude-raycast-notifier|${REPO_ROOT}|g" \
  "${REPO_ROOT}/config/gemini-settings.example.json" > "${GEMINI_SETTINGS}"

echo "Installed Claude hook config to ${CLAUDE_SETTINGS}"
echo "Installed Gemini hook config to ${GEMINI_SETTINGS}"

cd "${REPO_ROOT}/raycast-extension"
npm install

echo
echo "Install complete."
echo "Next steps:"
echo "1. Start the extension with: cd ${REPO_ROOT}/raycast-extension && ray develop"
echo "2. Open Raycast and run: Manage Hook Sounds"
echo "3. Confirm Needs Input and Done use the bundled Claude sounds"
