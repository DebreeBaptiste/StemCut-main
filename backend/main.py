from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import shutil
import json
import threading
import re
from pathlib import Path

import yt_dlp

from demucs_processor import process_audio
from export_mixer import create_mix

app = FastAPI(title="StemCut API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = Path("../storage")
STORAGE_DIR.mkdir(exist_ok=True)


# ── Progress helpers ──────────────────────────────────────────────────────────

def _write_progress(job_dir: Path, progress: int, message: str = "", status: str = "processing"):
    with open(job_dir / "progress.json", "w") as f:
        json.dump({"status": status, "progress": progress, "message": message}, f)


# ── Background job ────────────────────────────────────────────────────────────

def _download_youtube(youtube_url: str, job_dir: Path) -> Path:
    video_id_match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', youtube_url)
    if video_id_match:
        video_id = video_id_match.group(1)
        youtube_url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"🎬 Cleaned YouTube URL: {youtube_url}", flush=True)

    file_path = job_dir / "original.mp3"
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(job_dir / "original.%(ext)s"),
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])

    if not file_path.exists():
        candidates = list(job_dir.glob("original.*"))
        if not candidates:
            raise Exception("Aucun fichier audio produit depuis l'URL YouTube")
        file_path = candidates[0]

    return file_path


def _run_job(
    job_id: str,
    job_dir: Path,
    saved_file_path: Optional[Path],
    youtube_url: Optional[str],
):
    """Thread de traitement : téléchargement optionnel + Demucs."""
    try:
        file_path = saved_file_path

        if youtube_url:
            _write_progress(job_dir, 3, "Téléchargement YouTube...")
            file_path = _download_youtube(youtube_url, job_dir)
            _write_progress(job_dir, 12, "Démarrage de la séparation...")
        else:
            _write_progress(job_dir, 10, "Démarrage de la séparation...")

        def on_progress(p: int, msg: str = ""):
            _write_progress(job_dir, p, msg)

        process_audio(str(file_path), str(job_dir), progress_callback=on_progress)
        _write_progress(job_dir, 100, "Terminé !", status="completed")

    except Exception as e:
        print(f"❌ Job {job_id} failed: {e}", flush=True)
        _write_progress(job_dir, 0, str(e), status="error")


# ── Models ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    job_id: str
    muted_stems: List[str] = []


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/input")
async def upload_audio(
    file: Optional[UploadFile] = File(None),
    youtube_url: Optional[str] = Form(None),
):
    """Reçoit un fichier audio ou une URL YouTube et démarre la séparation en arrière-plan."""
    job_id = str(uuid.uuid4())
    job_dir = STORAGE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    _write_progress(job_dir, 0, "Initialisation...")

    saved_file_path: Optional[Path] = None

    if file:
        file_path = job_dir / "original.mp3"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_file_path = file_path
        _write_progress(job_dir, 8, "Fichier reçu, démarrage...")
    elif youtube_url:
        pass  # le téléchargement se fait dans le thread
    else:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="No file or youtube_url provided")

    thread = threading.Thread(
        target=_run_job,
        args=(job_id, job_dir, saved_file_path, youtube_url),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id, "status": "processing"}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Retourne la progression du job."""
    job_dir = STORAGE_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    progress_file = job_dir / "progress.json"
    if progress_file.exists():
        with open(progress_file) as f:
            return json.load(f)

    # Fallback si pas encore de fichier progress
    stems_ready = all(
        (job_dir / f"{s}.mp3").exists() or (job_dir / f"{s}.wav").exists()
        for s in ["vocals", "drums", "bass", "other"]
    )
    if stems_ready:
        return {"status": "completed", "progress": 100, "message": "Terminé !"}

    return {"status": "processing", "progress": 0, "message": ""}


@app.get("/api/tracks/{job_id}")
async def get_tracks(job_id: str):
    """Récupère les URLs des 4 stems."""
    job_dir = STORAGE_DIR / job_id

    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    stem_names = ["vocals", "drums", "bass", "other"]
    stems = {}

    for stem in stem_names:
        mp3_path = job_dir / f"{stem}.mp3"
        wav_path = job_dir / f"{stem}.wav"

        if mp3_path.exists():
            stems[stem] = f"/api/stream/{job_id}/{stem}.mp3"
        elif wav_path.exists():
            stems[stem] = f"/api/stream/{job_id}/{stem}.wav"
        else:
            raise HTTPException(status_code=404, detail=f"Stem {stem} not found")

    return {"stems": stems}


@app.get("/api/stream/{job_id}/{filename}")
async def stream_audio(job_id: str, filename: str):
    """Streame un fichier audio."""
    file_path = STORAGE_DIR / job_id / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    ext = file_path.suffix.lower()
    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".m4a": "audio/mp4",
    }
    return FileResponse(file_path, media_type=media_types.get(ext, "audio/mpeg"))


@app.post("/api/export")
async def export_mix(request: ExportRequest):
    """Génère un mix personnalisé selon les stems mutés."""
    job_dir = STORAGE_DIR / request.job_id

    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        output_path = create_mix(str(job_dir), request.muted_stems)
        return FileResponse(
            output_path,
            media_type="audio/mpeg",
            filename=f"stemcut_mix_{request.job_id}.mp3",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.get("/api/jobs")
async def list_jobs():
    """Liste tous les jobs avec leurs métadonnées."""
    jobs = []

    if not STORAGE_DIR.exists():
        return {"jobs": []}

    for job_dir in STORAGE_DIR.iterdir():
        if not job_dir.is_dir():
            continue

        job_id = job_dir.name

        original_file = job_dir / "original.mp3"
        if not original_file.exists():
            candidates = list(job_dir.glob("original.*"))
            original_file = candidates[0] if candidates else None

        stems_ready = all(
            (job_dir / f"{s}.mp3").exists() or (job_dir / f"{s}.wav").exists()
            for s in ["vocals", "drums", "bass", "other"]
        )

        created_at = job_dir.stat().st_ctime
        total_size = sum(f.stat().st_size for f in job_dir.rglob("*") if f.is_file())

        jobs.append({
            "job_id": job_id,
            "created_at": created_at,
            "has_original": original_file is not None and original_file.exists(),
            "stems_ready": stems_ready,
            "size_bytes": total_size,
            "size_mb": round(total_size / (1024 * 1024), 2),
        })

    jobs.sort(key=lambda x: x["created_at"], reverse=True)
    return {"jobs": jobs}


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Supprime un job et tous ses fichiers."""
    job_dir = STORAGE_DIR / job_id

    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        shutil.rmtree(job_dir)
        return {"status": "deleted", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@app.get("/")
async def root():
    return {"message": "StemCut API is running"}
