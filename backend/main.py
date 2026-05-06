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
import subprocess
import tempfile
import logging
from logging.handlers import RotatingFileHandler

import yt_dlp
import imageio_ffmpeg
from pydub import AudioSegment

# ── Setup logging first ──────────────────────────────────────────────────────────

STORAGE_DIR = Path(
    os.environ.get("STEMCUT_STORAGE", str((Path(__file__).parent.parent / "storage").resolve()))
)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

_handler = RotatingFileHandler(
    STORAGE_DIR / "stemcut.log", maxBytes=1_000_000, backupCount=2, encoding="utf-8"
)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logging.root.addHandler(_handler)
logging.root.setLevel(logging.DEBUG)
log = logging.getLogger("stemcut")
log.info("Backend starting, storage=%s", STORAGE_DIR)


def _setup_ffmpeg() -> str:
    """Setup FFmpeg symlinks in temp directory."""
    try:
        log.info("🎬 Initializing FFmpeg...")
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        log.debug(f"   FFmpeg executable: {exe}")
        
        tmp_dir = os.path.join(tempfile.gettempdir(), 'stemcut_ffmpeg')
        os.makedirs(tmp_dir, exist_ok=True)

        _is_win = os.name == 'nt'
        for name in ('ffmpeg', 'ffprobe'):
            dest_name = (name + '.exe') if _is_win else name
            link = os.path.join(tmp_dir, dest_name)
            if os.path.islink(link) or os.path.exists(link):
                os.unlink(link)
            try:
                os.symlink(exe, link)
                log.debug(f"   Symlinked {dest_name}")
            except (OSError, NotImplementedError):
                import shutil as _shutil
                _shutil.copy2(exe, link)
                log.debug(f"   Copied {dest_name}")

        os.environ['PATH'] = tmp_dir + os.pathsep + os.environ.get('PATH', '')
        _ffmpeg_bin = os.path.join(tmp_dir, 'ffmpeg.exe' if _is_win else 'ffmpeg')
        _ffprobe_bin = os.path.join(tmp_dir, 'ffprobe.exe' if _is_win else 'ffprobe')
        AudioSegment.converter = _ffmpeg_bin
        AudioSegment.ffprobe = _ffprobe_bin
        log.info("✅ FFmpeg initialized")
        return tmp_dir
    except Exception as e:
        log.error(f"❌ FFmpeg setup failed: {e}")
        raise


_FFMPEG_DIR = _setup_ffmpeg()

from demucs_processor import process_audio
from export_mixer import create_mix
from daw_exporter import create_daw_export

app = FastAPI(title="StemCut API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Progress helpers ──────────────────────────────────────────────────────────

def _write_progress(job_dir: Path, progress: int, message: str = "", status: str = "processing"):
    with open(job_dir / "progress.json", "w") as f:
        json.dump({"status": status, "progress": progress, "message": message}, f)


# ── Background job ────────────────────────────────────────────────────────────

def _download_youtube(youtube_url: str, job_dir: Path, progress_cb=None) -> Path:
    video_id_match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', youtube_url)
    if video_id_match:
        video_id = video_id_match.group(1)
        youtube_url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"🎬 Cleaned YouTube URL: {youtube_url}", flush=True)

    def _ydl_hook(d):
        if d['status'] == 'downloading' and progress_cb:
            pct_str = d.get('_percent_str', '').strip().rstrip('%')
            try:
                pct = float(pct_str)
                mapped = int(3 + pct * 0.09)  # 3% → 12% range
                progress_cb(mapped, f"YouTube: {d.get('_percent_str', '?').strip()}")
            except (ValueError, TypeError):
                pass

    ydl_opts = {
        # Prend le meilleur audio disponible, quelle que soit l'extension
        "format": "bestaudio/best",
        "outtmpl": str(job_dir / "original.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "ffmpeg_location": _FFMPEG_DIR,
        "socket_timeout": 30,
        "retries": 3,
        "progress_hooks": [_ydl_hook],
        # Pas de FFmpegExtractAudio : imageio_ffmpeg ne fournit pas ffprobe
        # La conversion MP3 est faite manuellement après téléchargement
    }

    print(f"⬇️  Starting yt-dlp download to {job_dir}", flush=True)
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])
    print(f"⬇️  yt-dlp download finished", flush=True)

    candidates = list(job_dir.glob("original.*"))
    if not candidates:
        raise Exception("Aucun fichier audio produit depuis l'URL YouTube")
    downloaded = candidates[0]

    mp3_path = job_dir / "original.mp3"
    if downloaded.suffix.lower() != ".mp3":
        ffmpeg_exe = os.path.join(_FFMPEG_DIR, 'ffmpeg.exe' if os.name == 'nt' else 'ffmpeg')
        subprocess.run(
            [ffmpeg_exe, '-y', '-i', str(downloaded), '-vn', '-ab', '192k', '-ar', '44100', str(mp3_path)],
            check=True, capture_output=True,
        )
        downloaded.unlink(missing_ok=True)

    return mp3_path


def _run_job(
    job_id: str,
    job_dir: Path,
    saved_file_path: Optional[Path],
    youtube_url: Optional[str],
):
    """Thread de traitement : téléchargement optionnel + Demucs."""
    try:
        file_path = saved_file_path
        log.info("Job %s started, file=%s youtube=%s", job_id, saved_file_path, youtube_url)

        def on_progress(p: int, msg: str = ""):
            log.debug("Job %s progress %s%% %s", job_id, p, msg)
            _write_progress(job_dir, p, msg)

        if youtube_url:
            _write_progress(job_dir, 3, "Téléchargement YouTube...")
            file_path = _download_youtube(youtube_url, job_dir, progress_cb=on_progress)
            _write_progress(job_dir, 12, "Démarrage de la séparation...")
        else:
            _write_progress(job_dir, 10, "Démarrage de la séparation...")

        log.info("Job %s calling process_audio", job_id)
        process_audio(str(file_path), str(job_dir), progress_callback=on_progress)
        log.info("Job %s completed", job_id)
        _write_progress(job_dir, 100, "Terminé !", status="completed")

    except Exception as e:
        log.exception("Job %s failed: %s", job_id, e)
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


@app.get("/api/export/daw/{job_id}")
async def export_daw_pack(job_id: str):
    """Génère un pack ZIP prêt à importer dans un DAW."""
    job_dir = STORAGE_DIR / job_id

    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        output_path = create_daw_export(str(job_dir), job_id)
        return FileResponse(
            output_path,
            media_type="application/zip",
            filename=f"stemcut_daw_{job_id[:8]}.zip",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DAW export failed: {str(e)}")


@app.get("/api/bpm/{job_id}")
async def get_bpm(job_id: str):
    """Détecte le BPM d'un job (résultat mis en cache dans bpm.json)."""
    job_dir = STORAGE_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    bpm_file = job_dir / "bpm.json"
    if bpm_file.exists():
        with open(bpm_file) as f:
            return json.load(f)

    audio_path: Optional[Path] = None
    for name in ("original.mp3", "original.wav", "original.flac", "original.m4a"):
        p = job_dir / name
        if p.exists():
            audio_path = p
            break

    if audio_path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")

    import asyncio
    import concurrent.futures

    def _detect_bpm(path: str):
        import librosa  # import local pour ne pas ralentir le démarrage
        y, sr = librosa.load(path, sr=None, duration=60, mono=True)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        bpm_val = round(float(tempo), 1)
        first_beat = round(float(beat_times[0]), 3) if len(beat_times) > 0 else 0.0
        return {"bpm": bpm_val, "first_beat": first_beat}

    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        result = await loop.run_in_executor(pool, _detect_bpm, str(audio_path))

    with open(bpm_file, "w") as f:
        json.dump(result, f)

    return result


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

        name = None
        favorite = False
        duration_s = None
        progress_file = job_dir / "progress.json"
        data: dict = {}
        if progress_file.exists():
            with open(progress_file) as f:
                data = json.load(f)
            name = data.get("name")
            favorite = data.get("favorite", False)
            duration_s = data.get("duration_s")

        if duration_s is None and original_file and original_file.exists():
            try:
                audio = AudioSegment.from_file(str(original_file))
                duration_s = round(len(audio) / 1000)
                data["duration_s"] = duration_s
                with open(progress_file, "w") as f:
                    json.dump(data, f)
            except Exception:
                pass

        jobs.append({
            "job_id": job_id,
            "created_at": created_at,
            "has_original": original_file is not None and original_file.exists(),
            "stems_ready": stems_ready,
            "size_bytes": total_size,
            "size_mb": round(total_size / (1024 * 1024), 2),
            "name": name,
            "favorite": favorite,
            "duration_s": duration_s,
        })

    jobs.sort(key=lambda x: x["created_at"], reverse=True)
    return {"jobs": jobs}


class RenameRequest(BaseModel):
    name: str


class FavoriteRequest(BaseModel):
    favorite: bool


@app.patch("/api/jobs/{job_id}/favorite")
async def set_job_favorite(job_id: str, body: FavoriteRequest):
    """Met à jour le statut favori d'un job."""
    job_dir = STORAGE_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    progress_file = job_dir / "progress.json"
    data: dict = {}
    if progress_file.exists():
        with open(progress_file) as f:
            data = json.load(f)

    data["favorite"] = body.favorite
    with open(progress_file, "w") as f:
        json.dump(data, f)

    return {"job_id": job_id, "favorite": body.favorite}


@app.patch("/api/jobs/{job_id}/name")
async def rename_job(job_id: str, body: RenameRequest):
    """Met à jour le nom personnalisé d'un job."""
    job_dir = STORAGE_DIR / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")

    progress_file = job_dir / "progress.json"
    data: dict = {}
    if progress_file.exists():
        with open(progress_file) as f:
            data = json.load(f)

    data["name"] = body.name.strip()
    with open(progress_file, "w") as f:
        json.dump(data, f)

    return {"job_id": job_id, "name": data["name"]}


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
