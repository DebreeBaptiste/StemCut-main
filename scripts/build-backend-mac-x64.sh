#!/usr/bin/env bash
# Build the StemCut FastAPI backend as a self-contained macOS x86_64 binary
# using PyInstaller under Rosetta 2.
#
# Run this on an Apple Silicon Mac that has Rosetta 2 installed.
# On a native Intel Mac, run build-backend-mac.sh instead (after creating a
# regular x64 Python venv).
#
# Output: dist-backend/stemcut-backend/  (picked up by electron-builder)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$REPO/backend"
VENV_X64="$REPO/.venv_x64"

echo "=== StemCut — Build backend macOS x64 (via Rosetta 2) ==="

# ── Check Rosetta ─────────────────────────────────────────────────────────────
if ! arch -x86_64 true 2>/dev/null; then
  echo "❌  Rosetta 2 not found."
  echo "    Install with: softwareupdate --install-rosetta"
  exit 1
fi

# ── Create x64 venv if absent ─────────────────────────────────────────────────
if [ ! -d "$VENV_X64" ]; then
  echo ""
  echo "📦  Creating x64 venv via Rosetta 2..."
  echo "    ⚠️  First time: ~15–30 min to download PyTorch + Demucs (~3–4 GB)"
  echo ""
  arch -x86_64 /usr/bin/python3 -m venv "$VENV_X64"
  arch -x86_64 "$VENV_X64/bin/pip" install --upgrade pip
  arch -x86_64 "$VENV_X64/bin/pip" install -r "$BACKEND/requirements.txt"
  echo "✅  x64 venv ready"
else
  echo "✅  x64 venv already present (delete .venv_x64 to force reinstall)"
fi

# ── Ensure PyInstaller is available ───────────────────────────────────────────
arch -x86_64 "$VENV_X64/bin/pip" install --quiet --upgrade pyinstaller

# ── Clean previous artefacts ──────────────────────────────────────────────────
rm -rf "$REPO/dist-backend" "$REPO/build-backend"

# ── Run PyInstaller from the backend directory (under Rosetta) ────────────────
cd "$BACKEND"
arch -x86_64 "$VENV_X64/bin/pyinstaller" \
  --distpath "$REPO/dist-backend" \
  --workpath "$REPO/build-backend" \
  stemcut_backend.spec

echo ""
echo "✅  x64 backend binary ready: $REPO/dist-backend/stemcut-backend/"
