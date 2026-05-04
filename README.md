# StemCut 🎧✂️

Application locale de séparation audio en stems. Drag & drop une chanson, mutez ce que vous voulez, exportez votre mix parfait.

---

## Distribution — DMG prêt à partager

Les DMG publiés sont **autonomes** : aucun Python, aucun venv requis chez le destinataire.

### Installation (utilisateur final)

1. Télécharger le DMG correspondant à votre Mac :
   - **`StemCut-arm64.dmg`** → Mac Apple Silicon (M1/M2/M3/M4)
   - **`StemCut-x64.dmg`** → Mac Intel
2. Glisser `StemCut.app` dans `/Applications`
3. Au **premier lancement**, macOS peut bloquer l'app (app non notarisée).  
   Exécuter une seule fois dans Terminal :
   ```bash
   xattr -cr /Applications/StemCut.app
   ```
4. Lancer StemCut depuis le Launchpad ou Spotlight.

> **Note :** lors du tout premier traitement, Demucs télécharge ses modèles (~1 Go) dans `~/.cache/torch/hub/`. Une connexion internet est nécessaire la première fois uniquement.

---

## Développement

### Prérequis

- Node.js ≥ 18
- Python ≥ 3.10

### 1. Backend (Python)

```bash
# Créer le venv à la racine du repo
python3 -m venv .venv
source .venv/bin/activate

# Installer les dépendances
pip install -r backend/requirements.txt
```

### 2. Frontend (Node.js)

```bash
cd frontend
npm install
```

## Lancement rapide (dev)

### Option 1: Launcher one-click (recommandé)

```bash
./launcher.sh
```

Ouvre automatiquement:

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### Option 2: Lancement manuel

**Terminal 1 - Backend:**

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

---

## Build des DMG

### Pré-requis build

```bash
# Installer toutes les dépendances backend dans le venv racine
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

### DMG macOS arm64 (Apple Silicon — natif)

```bash
npm run electron:build
# → dist/StemCut-*-arm64.dmg
```

Ce script :
1. Build le frontend Next.js standalone
2. Package le backend Python en binaire autonome via PyInstaller (`scripts/build-backend-mac.sh`)
3. Package l'app Electron avec electron-builder

### DMG macOS x64 (Intel — via Rosetta depuis Apple Silicon)

> Requis : Rosetta 2 (`softwareupdate --install-rosetta`)

```bash
npm run electron:build:x64
# → dist/StemCut-*-x64.dmg
```

Ce script crée un venv x64 dédié (`.venv_x64/`) via `arch -x86_64`, installe les dépendances en x64, puis génère le binaire et le DMG Intel.

> ⚠️ Première exécution : ~15–30 min (téléchargement PyTorch x64 ~3–4 Go).

### Build backend uniquement (sans electron-builder)

```bash
npm run build:backend        # arm64
npm run build:backend:x64    # x64 (via Rosetta)
# → dist-backend/stemcut-backend/
```

---

## Utilisation

1. **Upload** - Glissez un fichier MP3/WAV/FLAC
2. **Wait** - Demucs traite l'audio (30s-2min selon le matériel)
3. **Play** - Contrôlez les 4 stems (vocals, drums, bass, other)
4. **Export** - Téléchargez votre mix personnalisé

## Structure

```
stemcut/
├── backend/              # FastAPI + Demucs
│   ├── main.py          # API endpoints
│   ├── demucs_processor.py
│   ├── export_mixer.py
│   └── stemcut_backend.spec  # PyInstaller spec
├── frontend/            # Next.js + Zustand
│   ├── app/
│   ├── components/
│   └── store/
├── scripts/
│   ├── build-backend-mac.sh      # Build binaire arm64
│   ├── build-backend-mac-x64.sh  # Build binaire x64 (Rosetta)
│   └── afterSign.js              # Ad-hoc signing
├── storage/             # Fichiers audio traités localement
└── launcher.sh          # Script de démarrage dev
```

## Stack technique

- **Backend**: FastAPI, Demucs, PyDub
- **Frontend**: Next.js, TypeScript, Zustand, Tailwind CSS
- **ML**: Demucs (Facebook Research) - séparation en 4 stems
- **Packaging**: PyInstaller (backend), electron-builder (app)

## Roadmap

- [ ] Waveform visualization
- [ ] Playback speed control

## License

Personal project - Usage local uniquement

