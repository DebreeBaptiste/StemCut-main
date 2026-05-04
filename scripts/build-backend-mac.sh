#!/usr/bin/env bash
# Build the StemCut FastAPI backend as a self-contained macOS arm64 binary
# using PyInstaller.
#
# Prerequisites:
#   - .venv/ at the repo root with all backend/requirements.txt installed
#   - PyInstaller (auto-installed into the venv by this script)
#
# Output: dist-backend/stemcut-backend/  (picked up by electron-builder)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$REPO/backend"
VENV="$REPO/.venv"

echo "=== StemCut — Build backend macOS arm64 ==="

# ── Sanity check ──────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
  echo "❌  .venv not found at $VENV"
  echo "    Set it up with:"
  echo "      python3 -m venv .venv"
  echo "      .venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

# ── Ensure PyInstaller is available ───────────────────────────────────────────
"$VENV/bin/pip" install --quiet --upgrade pyinstaller

# ── Clean previous artefacts ──────────────────────────────────────────────────
rm -rf "$REPO/dist-backend" "$REPO/build-backend"

# ── Run PyInstaller from the backend directory ────────────────────────────────
cd "$BACKEND"
"$VENV/bin/pyinstaller" \
  --distpath "$REPO/dist-backend" \
  --workpath "$REPO/build-backend" \
  stemcut_backend.spec

echo ""
echo "✅  Backend binary ready: $REPO/dist-backend/stemcut-backend/"
