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
