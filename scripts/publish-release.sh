#!/usr/bin/env bash
# Publie une release GitHub depuis les fichiers pré-compilés du dossier release/
# Usage: ./scripts/publish-release.sh [v1.0.0]
set -e

VERSION=${1:-"v$(node -p "require('./package.json').version")"}
RELEASE_DIR="release"

if [ -z "$(ls -A $RELEASE_DIR 2>/dev/null)" ]; then
  echo "Erreur : le dossier '$RELEASE_DIR/' est vide ou inexistant."
  echo "Mets les fichiers .dmg et .exe dedans avant de lancer ce script."
  exit 1
fi

echo "Fichiers à publier :"
ls -lh "$RELEASE_DIR/"
echo ""
echo "Tag : $VERSION"
echo ""
read -p "Confirmer la publication ? (y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 0; }

# Crée le tag local si il n'existe pas
if ! git tag -l | grep -q "^${VERSION}$"; then
  git tag "$VERSION"
  echo "Tag local $VERSION créé."
fi

# Crée la release GitHub avec les fichiers du dossier release/
# --create-refspec crée aussi le tag sur GitHub si absent
gh release create "$VERSION" \
  "$RELEASE_DIR"/* \
  --title "StemCut $VERSION" \
  --generate-notes

echo ""
echo "Release $VERSION publiée avec succès."
echo "Le workflow CI détectera les assets existants et sautera le build."
