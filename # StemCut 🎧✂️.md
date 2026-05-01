# StemCut 🎧✂️

StemCut is a **minimal, local, Moises-like application** that lets you split a song into stems, mute what you don’t want, and export exactly the mix you need.

Built for musicians who want to **practice**, not subscribe.

---

## 🎯 Purpose

> Drag & drop a song → get the stems → mute instruments → download the exact version you want.

Typical use cases:

- Practice **bass** without the bass
- Practice **guitar** without vocals
- Get **drums-only** tracks
- Jam over a clean instrumental

**Bonus (hidden)**: optionally, provide a **YouTube link**, automatically converted to MP3 and processed locally.

---

## ✨ Features

### MVP

1. **Upload audio**

   - MP3, WAV, FLAC
   - Drag & drop or button

2. **Automatic stem separation** (via Demucs)

   - 🎤 Vocals
   - 🥁 Drums
   - 🎸 Bass
   - 🎹 Other (guitar / synth / rest)

3. **Multi-track audio player**

   - Play / Pause global
   - Shared timeline
   - Mute / Unmute per stem
   - Volume per stem
   - Download stems individually

4. **Custom export**

   - Generate mix according to muted stems
   - Presets: “No Bass”, “No Vocals”, etc.

5. **YouTube input (optional & hidden)**
   - Backend accepts `youtube_url`
   - Converts YouTube to MP3 via `yt-dlp`
   - Processed like a normal audio file
   - Frontend hidden / flag-controlled
   - For personal use only

---

### Optional / Future Features

- Local project/session saving
- Waveform visualization (WaveSurfer.js)
- Playback speed control (slow down)
- Note detection for bass/guitar
- MIDI export (experimental)

---

## 🏗️ Tech Stack

### Frontend

- Next.js (App Router)
- TypeScript
- Silk HQ
- HTML `<audio>` for MVP, Web Audio API optional later

### Backend

- FastAPI
- Demucs for stem separation
- PyDub for mix/export
- yt-dlp for YouTube → MP3
- Local file storage

---

## 🔌 API (Simplified)

### Upload / Input

```http
POST /api/input
- Body: { file (optional), youtube_url (optional) }
- Response: { job_id }
Get stems
http
Copier le code
GET /api/tracks/{job_id}
- Response: { vocals, bass, drums, other }
Export custom mix
http
Copier le code
POST /api/export
- Body: { job_id, mute: ["bass","other"] }
- Response: MP3 file
Note: youtube_url is optional and hidden for personal use.

🎨 UX / UI
Single-page app

Drag & drop upload

Loader / progress indicator

Multi-track player cards: Mute / Volume / Download

Export section

“New Song” button

YouTube input hidden (backend only or flag)

🔧 Constraints
Local use only

No file size limits (manual cleanup)

Supported formats: MP3, WAV, FLAC

Processing time depends on hardware

YouTube feature hidden / optional / personal use

⏱️ Timeline (Estimated)
Day 1: Backend + Demucs + audio upload

Day 2: Multi-track player + mute/volume/download

Day 3: Custom export

Day 4: Hidden YouTube input + tests

🔒 Notes
YouTube feature not exposed publicly

Personal / offline usage only

No sharing of generated files

🎓 Roadmap
V2

Note detection for bass/guitar

Slow down playback

V3

Waveforms, keyboard shortcuts, session history

Tauri / native app packaging

🖥️ Bonus — Desktop App (Tauri)
Optional packaging as native desktop app

Double-click → open without IDE or terminal

Lightweight, cross-platform (Windows/macOS/Linux)

Backend (FastAPI + Python) launched automatically

Frontend (Next.js) served inside app window

Future roadmap: bundle .app / .exe

📚 Credits
Demucs — Facebook Research

FastAPI

Next.js

Silk HQ

Tauri

yt-dlp

📜 License
Personal project — free to use for learning and practice.
```
