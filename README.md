# StemCut 🎧✂️

Application locale de séparation audio en stems. Drag & drop une chanson, mutez ce que vous voulez, exportez votre mix parfait.

## Distribution (utilisateurs finaux)

Téléchargez le DMG correspondant à votre Mac :

| Architecture | Fichier |
| --- | --- |
| Apple Silicon (M1/M2/M3…) | `StemCut-*-arm64.dmg` |
| Intel (x86_64) | `StemCut-*-x64.dmg` |

Après installation :

```bash
# Une seule fois, pour lever la quarantaine Gatekeeper
xattr -cr /Applications/StemCut.app
```

> **Premier lancement** : Demucs télécharge le modèle htdemucs (~450 Mo) dans `~/.cache/torch/hub/`. Les lancements suivants ne le re-téléchargent pas.

Les fichiers de travail (stems, jobs) sont stockés dans `~/Library/Application Support/StemCut/storage/`.

---

## Développement (contributeurs)

### Prérequis

- Node.js ≥ 18
- Python ≥ 3.10

### 1. Backend (Python)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Frontend (Node.js)

```bash
cd frontend
npm install
```

### Lancement dev

**Terminal 1 — Backend :**

```bash
cd backend
../.venv/bin/uvicorn main:app --reload
```

**Terminal 2 — Frontend :**

```bash
cd frontend
npm run dev
```

Ou via le launcher one-click :

```bash
./launcher.sh
```

### Build DMG (macOS)

#### macOS arm64 — Apple Silicon natif

```bash
# Doit être exécuté sur un Mac (bash requis).
# Construit le binaire PyInstaller puis package le DMG → dist/StemCut-*-arm64.dmg
npm run electron:build
```

#### macOS x64 — Intel (depuis Apple Silicon via Rosetta 2)

```bash
# Doit être exécuté sur un Mac Apple Silicon avec Rosetta 2 installé.
npm run electron:build:x64
```

#### Windows

```powershell
npm run electron:build:windows
```

> Les DMG macOS doivent être construits sur macOS. Le binaire PyInstaller (`dist-backend/stemcut-backend/`) est généré par `scripts/build-backend-mac.sh` et intégré dans `Resources/backend-bin/` — aucun Python n'est requis chez l'utilisateur final.

---

## Utilisation

1. **Upload** — Glissez un fichier MP3/WAV/FLAC ou collez une URL YouTube
2. **Wait** — Demucs traite l'audio (30 s – 2 min selon la machine)
3. **Play** — Contrôlez les 4 stems (vocals, drums, bass, other)
4. **Export** — Téléchargez votre mix personnalisé

## Structure

```text
stemcut/
├── backend/
│   ├── main.py               # API endpoints FastAPI
│   ├── demucs_processor.py   # Séparation (subprocess dev / API prod)
│   ├── export_mixer.py       # Export mix personnalisé
│   ├── server_entry.py       # Point d'entrée PyInstaller
│   └── stemcut_backend.spec  # Spec PyInstaller
├── frontend/                 # Next.js + Zustand + Tailwind
├── electron/                 # Electron shell
├── scripts/
│   ├── build-backend-mac.sh  # Binaire arm64
│   └── build-x64.sh          # Binaire + DMG x64 (Rosetta 2)
├── dist-backend/             # Binaire PyInstaller (gitignored)
└── storage/                  # Fichiers audio dev (gitignored)
```

## Stack technique

- **Backend** : FastAPI, Demucs, PyDub, yt-dlp, imageio-ffmpeg
- **Frontend** : Next.js, TypeScript, Zustand, Tailwind CSS
- **ML** : Demucs (Meta Research) — séparation en 4 stems
- **Packaging** : Electron, PyInstaller (backend autonome)

## License

Personal project — Usage local uniquement
