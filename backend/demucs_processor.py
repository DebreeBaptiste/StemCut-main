"""Wrapper pour Demucs - séparation audio en 4 stems.

En mode développement (non-gelé) : exécute Demucs en subprocess pour avoir
la sortie tqdm en temps réel.
En mode production (binaire PyInstaller) : utilise l'API Python de Demucs
directement, car sys.executable est le binaire lui-même et `python -m demucs`
ne fonctionne pas dans ce contexte.
"""

import os
import re
import subprocess
import shutil
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from pydub import AudioSegment


def _is_frozen() -> bool:
    return getattr(sys, 'frozen', False)


def _compress_stem_to_mp3(stem_path: Path, progress_callback: Optional[Callable] = None, label: str = "") -> None:
    if not stem_path.exists() or stem_path.suffix.lower() != ".wav":
        return
    mp3_path = stem_path.with_suffix(".mp3")
    if mp3_path.exists():
        return
    audio = AudioSegment.from_wav(str(stem_path))
    audio.export(str(mp3_path), format="mp3", bitrate="192k")
    if mp3_path.exists():
        stem_path.unlink(missing_ok=True)


def _get_best_device() -> str:
    if os.environ.get("STEMCUT_FORCE_CPU") == "1":
        return "cpu"
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def _model_is_cached() -> bool:
    cache_dir = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"
    return cache_dir.exists() and any(cache_dir.glob("htdemucs*"))


def _load_audio_no_ffprobe(input_path: str, samplerate: int, channels: int) -> 'torch.Tensor':
    """Load audio using ffmpeg→WAV→soundfile, without needing ffprobe.

    Demucs's AudioFile calls ffprobe internally; imageio_ffmpeg only ships
    ffmpeg (not ffprobe), so we bypass AudioFile entirely.
    """
    import torch
    import soundfile as sf
    from pydub import AudioSegment

    ffmpeg_exe = getattr(AudioSegment, 'converter', 'ffmpeg')

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp_path = tmp.name

    try:
        subprocess.run(
            [ffmpeg_exe, '-y', '-i', input_path,
             '-ar', str(samplerate), '-ac', str(channels),
             '-f', 'wav', tmp_path],
            check=True, capture_output=True,
        )
        data, _ = sf.read(tmp_path, dtype='float32', always_2d=True)
        # data: (samples, channels) → (channels, samples)
        return torch.from_numpy(data.T.copy())
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _heartbeat(stop_event: threading.Event, progress_callback: Callable, start_pct: int, msg: str):
    """Updates progress message every 10s so the UI doesn't look frozen."""
    elapsed = 0
    while not stop_event.wait(10):
        elapsed += 10
        progress_callback(start_pct, f"{msg} ({elapsed}s)")


def _process_via_api(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> None:
    """Production path: Demucs Python API (no subprocess). Used when frozen."""
    if progress_callback:
        progress_callback(11, "Initialisation des modules IA...")

    # Heartbeat during torch import (can take 30-60s in frozen binary)
    stop_init = threading.Event()
    if progress_callback:
        t = threading.Thread(target=_heartbeat, args=(stop_init, progress_callback, 11, "Initialisation des modules IA..."), daemon=True)
        t.start()

    import time as _time
    _t_start = _time.time()
    try:
        print("[init] importing torch...", flush=True)
        import torch
        print(f"[init] torch imported in {_time.time()-_t_start:.1f}s", flush=True)

        _t2 = _time.time()
        print("[init] importing demucs.pretrained...", flush=True)
        from demucs.pretrained import get_model
        print(f"[init] demucs.pretrained imported in {_time.time()-_t2:.1f}s", flush=True)

        _t3 = _time.time()
        print("[init] importing demucs.apply...", flush=True)
        from demucs.apply import apply_model
        print(f"[init] demucs.apply imported in {_time.time()-_t3:.1f}s", flush=True)

        _t4 = _time.time()
        print("[init] importing demucs.audio...", flush=True)
        from demucs.audio import save_audio
        print(f"[init] demucs.audio imported in {_time.time()-_t4:.1f}s - total init: {_time.time()-_t_start:.1f}s", flush=True)
    finally:
        stop_init.set()

    # Restore multi-threaded inference now that init is done
    # (OMP_NUM_THREADS=1 was set only to prevent init deadlocks)
    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))

    device = _get_best_device()
    print(f"Using device: {device} (frozen mode)", flush=True)

    if not _model_is_cached():
        if progress_callback:
            progress_callback(13, "Téléchargement du modèle Demucs (~450 Mo)...")
        stop_dl = threading.Event()
        if progress_callback:
            t2 = threading.Thread(target=_heartbeat, args=(stop_dl, progress_callback, 13, "Téléchargement du modèle (~450 Mo)..."), daemon=True)
            t2.start()
        try:
            model = get_model('htdemucs')
        except Exception as e:
            stop_dl.set()
            print(f"ERROR: Failed to download model: {e}", flush=True)
            if progress_callback:
                progress_callback(13, f"Erreur téléchargement: {str(e)[:50]}...")
            raise
        finally:
            stop_dl.set()
    else:
        if progress_callback:
            progress_callback(15, f"Chargement du modèle Demucs ({device})...")
        model = get_model('htdemucs')
    model.eval()
    if device != 'cpu':
        model.to(device)

    if progress_callback:
        progress_callback(20, "Chargement audio...")

    wav = _load_audio_no_ffprobe(input_path, model.samplerate, model.audio_channels)
    wav = wav.unsqueeze(0)  # add batch dimension: (1, channels, samples)
    if device != 'cpu':
        wav = wav.to(device)

    if progress_callback:
        progress_callback(25, "Séparation des stems...")

    if device == 'mps':
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'

    stop_infer = threading.Event()
    if progress_callback:
        _t0 = time.time()
        def _infer_heartbeat():
            while not stop_infer.wait(8):
                elapsed = int(time.time() - _t0)
                pct = min(26 + elapsed // 6, 79)
                progress_callback(pct, f"Séparation en cours... ({elapsed}s)")
        threading.Thread(target=_infer_heartbeat, daemon=True).start()

    try:
        with torch.no_grad():
            sources = apply_model(model, wav, progress=False)
    except Exception as e:
        if device != 'cpu':
            print(f"WARNING: {device} failed ({e}), falling back to CPU...", flush=True)
            if progress_callback:
                progress_callback(25, "Reprise sur CPU...")
            model.to('cpu')
            wav = wav.to('cpu')
            with torch.no_grad():
                sources = apply_model(model, wav, progress=False)
        else:
            raise
    finally:
        stop_infer.set()

    sources = sources[0]  # remove batch dim: (n_sources, channels, samples)

    if progress_callback:
        progress_callback(82, "Sauvegarde des stems...")

    out = Path(output_dir)
    for stem, source in zip(model.sources, sources):
        stem_path = out / f"{stem}.wav"
        save_audio(source.cpu(), str(stem_path), samplerate=model.samplerate)

    if progress_callback:
        progress_callback(85, "Compression MP3...")

    for i, stem in enumerate(model.sources):
        if progress_callback:
            progress_callback(85 + i * 3, f"Compression {stem}...")
        _compress_stem_to_mp3(out / f"{stem}.wav")

    shutil.rmtree(out / "htdemucs", ignore_errors=True)

    if progress_callback:
        progress_callback(98, "Finalisation...")

    print(f"Stems generated (MP3) in {output_dir}", flush=True)


def _process_via_subprocess(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> None:
    """Dev path: spawns `python -m demucs` subprocess for live tqdm output."""
    python_executable = sys.executable
    device = _get_best_device()
    print(f"Using device: {device}", flush=True)

    if progress_callback:
        progress_callback(15, f"Démarrage Demucs ({device})...")

    def run_demucs(dev: str) -> tuple:
        cmd = [
            python_executable, "-m", "demucs",
            "-n", "htdemucs",
            "-d", dev,
            input_path,
            "-o", output_dir,
        ]
        env = None
        if dev == "mps":
            import os
            env = __import__("os").environ.copy()
            env["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )

        all_lines = []
        for line in process.stdout:
            line = line.strip()
            if line:
                all_lines.append(line)
                print(f"[demucs/{dev}] {line}", flush=True)
            match = re.search(r"(\d+)%", line)
            if match and progress_callback:
                pct = int(match.group(1))
                mapped = 15 + int(pct * 0.65)
                progress_callback(mapped, f"Séparation des stems... {pct}%")

        process.wait()
        return process.returncode, "\n".join(all_lines[-30:])

    returncode, demucs_log = run_demucs(device)

    if returncode != 0 and device == "mps":
        print("WARNING: MPS failed, falling back to CPU...", flush=True)
        if progress_callback:
            progress_callback(15, "MPS indisponible, reprise sur CPU...")
        returncode, demucs_log = run_demucs("cpu")

    if returncode != 0:
        raise Exception(f"Demucs a échoué (code {returncode}): {demucs_log}")

    if progress_callback:
        progress_callback(82, "Déplacement des fichiers...")

    input_name = Path(input_path).stem
    demucs_output = Path(output_dir) / "htdemucs" / input_name

    if not demucs_output.exists():
        raise Exception("Dossier de sortie Demucs introuvable")

    stems = ["vocals", "drums", "bass", "other"]
    for i, stem in enumerate(stems):
        src = demucs_output / f"{stem}.wav"
        dst = Path(output_dir) / f"{stem}.wav"

        if src.exists():
            shutil.move(str(src), str(dst))
        else:
            raise Exception(f"Stem {stem} introuvable dans la sortie Demucs")

        if progress_callback:
            progress_callback(85 + i * 3, f"Compression {stem}...")
        _compress_stem_to_mp3(dst)

    shutil.rmtree(Path(output_dir) / "htdemucs", ignore_errors=True)

    if progress_callback:
        progress_callback(98, "Finalisation...")

    print(f"Stems generated (MP3) in {output_dir}", flush=True)


def process_audio(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
):
    """Traite un fichier audio avec Demucs et compresse les stems en MP3."""
    if _is_frozen():
        _process_via_api(input_path, output_dir, progress_callback)
    else:
        _process_via_subprocess(input_path, output_dir, progress_callback)
