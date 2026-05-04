#!/usr/bin/env bash
# Build StemCut DMG pour Mac Intel (x86_64) depuis un Mac Apple Silicon.
# Utilise Rosetta 2 pour créer un venv x64 et builder l'app Electron x64.
set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
VENV_X64="$REPO/.venv_x64"

echo "=== StemCut — Build Intel (x64) ==="
echo "Dossier : $REPO"

# ── 1. Vérifier que Rosetta est disponible ─────────────────────────────────
if ! arch -x86_64 true 2>/dev/null; then
  echo "❌ Rosetta 2 introuvable. Installe-le avec : softwareupdate --install-rosetta"
  exit 1
fi

# ── 2. Créer le venv x64 si absent ────────────────────────────────────────
if [ ! -d "$VENV_X64" ]; then
  echo ""
  echo "📦 Création du venv x64 (via Rosetta 2)..."
  echo "   ⚠️  Première fois : ~15-30 min pour télécharger PyTorch + Demucs (~3-4 Go)"
  echo ""
  arch -x86_64 /usr/bin/python3 -m venv "$VENV_X64"
  arch -x86_64 "$VENV_X64/bin/pip" install --upgrade pip
  arch -x86_64 "$VENV_X64/bin/pip" install -r "$REPO/backend/requirements.txt"
  arch -x86_64 "$VENV_X64/bin/pip" install pyinstaller
  echo "✅ venv x64 prêt"
else
  echo "✅ venv x64 déjà présent (supprimer .venv_x64 pour forcer la mise à jour)"
fi

# ── 3. Builder le binaire backend x64 ─────────────────────────────────────
echo ""
echo "🔨 Build binaire backend x64..."
cd "$REPO/backend"
arch -x86_64 "$VENV_X64/bin/pyinstaller" stemcut_backend.spec \
  --distpath "$REPO/dist-backend" \
  --workpath "$REPO/build-backend" \
  --noconfirm

# ── 4. Builder le frontend (si pas encore fait) ────────────────────────────
echo ""
echo "🔨 Build frontend Next.js..."
cd "$REPO/frontend" && npm run build
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public || true

# ── 5. Builder Electron x64 ────────────────────────────────────────────────
echo ""
echo "📦 Packaging Electron x64..."
cd "$REPO"
npx electron-builder --mac dmg --arch x64

echo ""
echo "✅ DMG Intel prêt : dist/StemCut-*-x64.dmg"
