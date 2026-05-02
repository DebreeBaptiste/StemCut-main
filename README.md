# StemCut 🎧✂️

Application locale de séparation audio en stems. Drag & drop une chanson, mutez ce que vous voulez, exportez votre mix parfait.

## Installation

### 1. Backend (Python)

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend (Node.js)

```bash
cd frontend
npm install
```

## Lancement rapide

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
cd backend
uvicorn main:app --reload
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

## Utilisation

1. **Upload** - Glissez un fichier MP3/WAV/FLAC
2. **Wait** - Demucs traite l'audio (30s-2min)
3. **Play** - Contrôlez les 4 stems (vocals, drums, bass, other)
4. **Export** - Téléchargez votre mix personnalisé

## Structure

```
stemcut/
├── backend/              # FastAPI + Demucs
│   ├── main.py          # API endpoints
│   ├── demucs_processor.py
│   └── export_mixer.py
├── frontend/            # Next.js + Zustand
│   ├── app/
│   ├── components/
│   └── store/
├── storage/             # Fichiers audio traités
└── launcher.sh          # Script de démarrage
```

## Stack technique

- **Backend**: FastAPI, Demucs, PyDub
- **Frontend**: Next.js, TypeScript, Zustand, Tailwind CSS
- **ML**: Demucs (Facebook Research) - séparation en 4 stems

## Roadmap

- [ ] YouTube input 
- [ ] Waveform visualization
- [ ] Playback speed control
- [ ] Packaging Tauri (app native)

## License

Personal project - Usage local uniquement
# StemCut

after install type : xattr -cr /Applications/StemCut.app
