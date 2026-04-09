#!/usr/bin/env bash
set -euo pipefail

REPO_API_URL="https://api.github.com/repos/fulln/claude-raycast-notifier/releases/latest"
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
need_cmd npm
need_cmd unzip
need_cmd python3

ASSET_URL="$(curl -fsSL "${REPO_API_URL}" | python3 -c '
import json, sys
release = json.load(sys.stdin)
assets = release.get("assets", [])
for asset in assets:
    url = asset.get("browser_download_url", "")
    if "/ai-hook-notifier-bundle-" in url and url.endswith(".zip"):
        print(url)
        break
else:
    raise SystemExit("Could not find install bundle asset in latest release")
')"

echo "Downloading install bundle from latest release"
curl -fL "${ASSET_URL}" -o "${TMP_DIR}/bundle.zip"

rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
unzip -q "${TMP_DIR}/bundle.zip" -d "${INSTALL_DIR}"

(
  cd "${INSTALL_DIR}"
  bash ./scripts/install.sh
)

echo
echo "Bootstrap complete."
echo "Open Raycast, then run:"
echo "  cd ${INSTALL_DIR}/raycast-extension && ray develop"
