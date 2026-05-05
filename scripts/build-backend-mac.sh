#!/usr/bin/env bash
# Build the StemCut backend as a self-contained arm64 binary via PyInstaller.
# Prerequisites: .venv must exist with all backend/requirements.txt installed + pyinstaller.
set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$REPO/.venv"

echo "=== StemCut — Build backend binary (arm64) ==="
echo "Repo: $REPO"

if [ ! -d "$VENV" ]; then
  echo "❌ .venv not found."
  echo "   Run: python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt pyinstaller"
  exit 1
fi

if ! "$VENV/bin/python" -c "import PyInstaller" 2>/dev/null; then
  echo "📦 Installing PyInstaller into .venv..."
  "$VENV/bin/pip" install pyinstaller
fi

# Ensure requirements are up to date (librosa may have been added after venv creation)
echo "📦 Syncing requirements..."
"$VENV/bin/pip" install -q -r "$REPO/backend/requirements.txt"

echo ""
echo "🔨 Running PyInstaller..."
cd "$REPO/backend"
"$VENV/bin/pyinstaller" stemcut_backend.spec \
  --distpath "$REPO/dist-backend" \
  --workpath "$REPO/build-backend" \
  --noconfirm

echo ""
echo "✅ Binary ready: dist-backend/stemcut-backend/"
