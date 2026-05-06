# 🔧 Windows Bundle Fix - Build Instructions

## Problème Résolu

L'app sur Windows était bloquée à "Initialisation des modules IA... (280s)" lors de la première utilisation.

## Cause

Le bundle PyInstaller ne contenait pas les modèles Demucs pré-téléchargés. À chaque nouveau démarrage sur une machine utilisateur, l'app tentait de télécharger le modèle (~450 MB), ce qui causait:

- Un délai de 180-280 secondes
- Potentiellement un blocage si la connexion était instable
- Un risque de deadlock des threads

## ✅ Solution Appliquée

1. **Préchargement des modèles** avant le build PyInstaller (`backend/preload_models.py`)
2. **Gestion d'erreurs robuste** pour le téléchargement du modèle
3. **Meilleur logging** pour le diagnostic

## 🚀 Comment Reconstruire

### Première Fois (recommandé pour mise à jour)

```powershell
cd "C:\Users\bdebre\works\StemCut-main"
.\scripts\build-windows.ps1
```

**Durée**: ~30-45 min la première fois (téléchargement Demucs + PyTorch ~3-4 GB)
**Résultat**: `dist\StemCut-v*.exe` prêt à distribuer

### Rebuild Rapide (si le modèle est déjà en cache)

```powershell
cd "C:\Users\bdebre\works\StemCut-main"
.\scripts\build-windows.ps1
```

Le script détecte le modèle en cache et saute le préchargement.

## 📋 Vérification

Après le build, testez sur une machine Windows fraîche:

1. Installer l'app
2. Upload un fichier audio
3. **Devrait** démarrer le traitement directement, sans "Initialisation IA..." prolongée

## 🔍 Diagnostic

Si l'app reste bloquée:

**Regarder les logs**:

```
C:\Users\{username}\AppData\Roaming\StemCut\storage\stemcut.log
C:\Users\{username}\AppData\Local\Temp\stemcut_startup.log
```

**Vérifier les modèles en cache**:

```powershell
dir "$env:USERPROFILE\.cache\torch\hub\checkpoints" -Recurse
```

## 📝 Fichiers Modifiés

- `backend/preload_models.py` - **NOUVEAU**: Précharge les modèles Demucs
- `backend/main.py` - Logging amélioré pour FFmpeg
- `backend/demucs_processor.py` - Gestion d'erreurs robuste
- `scripts/build-windows.ps1` - Ajout étape de préchargement
- `scripts/build-backend-mac.sh` - Ajout étape de préchargement (cohérence)

## ❓ Questions

**Q: Pourquoi forcer CPU au lieu d'utiliser GPU?**

- PyInstaller sur binaires gelés a des problèmes de stabilité avec CUDA/MPS
- C'est un compromis stabilité vs performance

**Q: Le modèle est stocké où?**

- `~/.cache/torch/hub/checkpoints/htdemucs*.pt` (~450 MB)

**Q: Puis-je utiliser le GPU?**

- Définissez avant de lancer l'app:
  ```powershell
  $env:STEMCUT_FORCE_CPU = "0"
  ```
- À vos risques et périls (instabilité possible)
