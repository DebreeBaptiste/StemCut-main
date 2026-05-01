# StemCut - AI Agent Instructions

## Project Overview

StemCut est une application **locale et minimaliste** de séparation audio en stems (similaire à Moises), permettant aux musiciens de pratiquer leur instrument en isolant ou supprimant des pistes spécifiques. L'architecture est un **monorepo Next.js + FastAPI**, avec traitement ML local via Demucs.

## Architecture & Stack

### Frontend (Next.js App Router)
- **Stack**: Next.js (App Router), TypeScript, Silk HQ pour l'UI
- **State**: Zustand pour gestion globale (player sync, stems, UI state)
- **Audio**: `<audio>` HTML pour MVP, Web Audio API pour contrôles avancés
- **Pattern**: Single-page app avec drag & drop, multi-track player synchronisé

### Backend (FastAPI)
- **Engine ML**: Demucs (Facebook Research) pour séparation en 4 stems: vocals, drums, bass, other
- **Audio Processing**: PyDub pour mixage et export
- **YouTube (caché)**: yt-dlp pour conversion YouTube → MP3 (usage personnel uniquement)
- **Storage**: Fichiers locaux, pas de cloud

### Flux de données
1. Upload fichier (MP3/WAV/FLAC) ou URL YouTube (caché) → Backend crée `job_id`
2. Demucs traite audio → génère 4 stems séparés stockés localement
3. Frontend récupère les stems via `/api/tracks/{job_id}`
4. Utilisateur contrôle lecture (mute/volume) puis exporte mix personnalisé via `/api/export`

## API Endpoints Critiques

```python
POST /api/input          # Upload file OU youtube_url (optionnel/caché)
GET /api/tracks/{job_id} # Récupère URLs des 4 stems
POST /api/export         # Génère mix selon stems mutés (ex: ["bass","vocals"])
```

## Conventions Projet-Spécifiques

### Séparation des stems
- **Toujours 4 stems**: vocals, drums, bass, other (guitar/synth/rest)
- Pas de séparation fine (pas de guitare isolée) - limitation Demucs
- Présets communs: "No Bass", "No Vocals", "Instrumental", "Drums Only"

### YouTube Feature
- **CACHÉ par défaut** dans l'UI (flag-controlled ou backend uniquement)
- Usage personnel/offline seulement - pas de partage public
- Backend accepte `youtube_url` en alternative à `file` dans `/api/input`

### Export personnalisé
- Utilisateur sélectionne stems à muter → backend mixe les stems non-mutés
- Format de sortie: MP3 (configurable)
- Pas de limite de taille (usage local, cleanup manuel)

## Workflows Développeur

### Structure du projet
```
stemcut/
├── backend/          # FastAPI + Demucs
├── frontend/         # Next.js App
└── launcher.sh       # Script one-click (futur: Tauri app)
```

### Lancer l'app en dev
```bash
# Backend (FastAPI)
cd backend && uvicorn main:app --reload

# Frontend (Next.js)
cd frontend && npm run dev
```

### Launcher automatique (roadmap)
```bash
# Script shell pour démarrage simultané
./launcher.sh  # Lance backend + frontend en parallèle

# Futur: Tauri app avec backend Python embarqué
# Double-clic → app native avec FastAPI + Next.js intégré
```

### Installer Demucs
```bash
pip install demucs
# Téléchargement automatique des modèles au premier usage
```

### Test de séparation
```python
# Utiliser Demucs directement
demucs -n htdemucs --two-stems=vocals audio.mp3
```

## Patterns à Suivre

### Zustand store structure
```typescript
// store/playerStore.ts
interface PlayerState {
  currentTime: number;
  isPlaying: boolean;
  stems: { vocals: StemState; drums: StemState; bass: StemState; other: StemState };
  jobId: string | null;
}
// Sync audio elements via store subscription
```

### Player multi-track synchronisé
- Tous les `<audio>` partagent le même `currentTime` (sync via état global Zustand)
- Mute = `volume: 0` (pas de pause individuelle)
- Export reflète l'état mute/volume de l'UI

### Gestion des jobs
- `job_id` utilisé comme clé pour retrouver stems et fichier source
- Structure: `/storage/{job_id}/` contient `original.mp3` + `vocals.wav`, `drums.wav`, etc.

### UI/UX
- Drag & drop avec loader/progress pour processing (Demucs prend ~30s-2min selon hardware)
- Bouton "New Song" pour reset l'état et permettre nouveau upload
- Cartes par stem avec contrôles: Mute toggle, Volume slider, Download individuel

## Considérations Importantes

- **Pas de backend cloud**: tout est local, pas de compte utilisateur
- **Performance**: Demucs nécessite GPU pour traitement rapide (CPU = lent)
- **Formats supportés**: MP3, WAV, FLAC (validation côté backend)
- **Roadmap future**: note detection, playback speed control, packaging Tauri pour app desktop

## Fichiers Clés (à créer)

- `backend/main.py` - FastAPI app avec endpoints /api/input, /api/tracks, /api/export
- `backend/demucs_processor.py` - Wrapper pour Demucs
- `frontend/app/page.tsx` - Page principale avec uploader + player
- `frontend/components/MultiTrackPlayer.tsx` - Player synchronisé avec contrôles par stem
- `frontend/components/ExportPanel.tsx` - Sélection presets + génération mix

## Testing

- Tester avec fichiers courts (<1min) pour itération rapide
- Vérifier sync audio entre les 4 stems
- Tester presets export communs (No Bass, Instrumental, etc.)
- YouTube input en dernier (feature cachée, non critique)
