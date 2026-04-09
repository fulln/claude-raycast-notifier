#!/usr/bin/env bash
set -euo pipefail

LATEST_BUNDLE_URL="https://github.com/fulln/claude-raycast-notifier/releases/latest/download/ai-hook-notifier-bundle-latest.zip"
INSTALL_DIR="${AI_HOOK_NOTIFIER_DIR:-${HOME}/.ai-hook-notifier}"
TMP_DIR="$(mktemp -d)"

detect_platform_mode() {
  if [ -n "${AI_HOOK_NOTIFIER_PLATFORM_MODE:-}" ]; then
    echo "${AI_HOOK_NOTIFIER_PLATFORM_MODE}"
    return
  fi

  local uname_s
  uname_s="$(uname -s 2>/dev/null || echo unknown)"

  case "${uname_s}" in
    Darwin)
      echo "full"
      ;;
    Linux)
      echo "hook-only"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "windows-unsupported"
      ;;
    *)
      echo "unsupported"
      ;;
  esac
}

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

PLATFORM_MODE="$(detect_platform_mode)"

case "${PLATFORM_MODE}" in
  full)
    echo "Detected macOS. Full install will configure hooks and Raycast support."
    ;;
  hook-only)
    echo "Detected Linux. Install will configure hooks only and skip Raycast startup."
    ;;
  windows-unsupported)
    echo "Native Windows is not supported by this installer." >&2
    echo "Use macOS for the Raycast experience." >&2
    echo "If you need hook-only support on Windows, use WSL or add a dedicated Windows installer first." >&2
    exit 1
    ;;
  unsupported)
    echo "Unsupported platform for this installer." >&2
    echo "Supported modes are macOS for full install and Linux for hook-only install." >&2
    exit 1
    ;;
esac

echo "Downloading install bundle from latest release"
curl -fL "${LATEST_BUNDLE_URL}" -o "${TMP_DIR}/bundle.zip"

rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
unzip -q "${TMP_DIR}/bundle.zip" -d "${INSTALL_DIR}"

(
  cd "${INSTALL_DIR}"
  AI_HOOK_NOTIFIER_PLATFORM_MODE="${PLATFORM_MODE}" bash ./scripts/install.sh
)

echo
echo "Bootstrap complete."
if [ "${PLATFORM_MODE}" = "full" ]; then
  echo "If Raycast is installed, the extension will be started automatically."
  echo "If Raycast is not installed, hooks are still active and the installer prints the config paths."
else
  echo "Hooks are installed."
  echo "Raycast startup was skipped on this platform."
fi
