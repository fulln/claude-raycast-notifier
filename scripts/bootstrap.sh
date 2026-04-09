#!/usr/bin/env bash
set -euo pipefail

LATEST_BUNDLE_URL="https://github.com/fulln/claude-raycast-notifier/releases/latest/download/ai-hook-notifier-bundle-latest.zip"
INSTALL_DIR="${AI_HOOK_NOTIFIER_DIR:-${HOME}/.ai-hook-notifier}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd bash
need_cmd node
need_cmd unzip

echo "Downloading install bundle from latest release"
curl -fL "${LATEST_BUNDLE_URL}" -o "${TMP_DIR}/bundle.zip"

rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
unzip -q "${TMP_DIR}/bundle.zip" -d "${INSTALL_DIR}"

(
  cd "${INSTALL_DIR}"
  bash ./scripts/install.sh
)

echo
echo "Bootstrap complete."
echo "If Raycast is installed, the extension will be started automatically."
echo "If Raycast is not installed, hooks are still active and the installer prints the config paths."
