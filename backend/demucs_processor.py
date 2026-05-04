"""Wrapper pour Demucs - séparation audio en 4 stems.

Ce module exécute Demucs de deux façons selon le contexte :

* **Mode développement** (script Python normal) : lance ``python -m demucs``
  en sous-processus pour conserver les logs tqdm en temps réel.
* **Mode bundle** (exécutable PyInstaller) : utilise directement l'API Python
  de Demucs — ``sys.executable`` n'est pas un interpréteur Python dans un
  bundle gelé, donc le sous-processus ne fonctionnerait pas.

Dans les deux cas, les stems WAV produits sont ensuite compressés en MP3 et
placés dans le dossier du job.
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional

from pydub import AudioSegment


def _is_frozen() -> bool:
    """Return True when running inside a PyInstaller bundle."""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


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
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


# ── Production path: demucs Python API ───────────────────────────────────────

def _process_via_api(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> None:
    """Separate stems using the demucs Python API (used in the frozen bundle)."""
    import os
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    from demucs.audio import AudioFile, save_audio

    device = _get_best_device()
    print(f"🎛️ Using device: {device}", flush=True)

    if progress_callback:
        progress_callback(15, f"Chargement du modèle Demucs ({device})...")

    model = get_model("htdemucs")
    model.to(device)

    if progress_callback:
        progress_callback(20, "Lecture du fichier audio...")

    wav = AudioFile(input_path).read(
        stems=model.sources,
        samplerate=model.samplerate,
        channels=2,
    )
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()

    if progress_callback:
        progress_callback(25, "Séparation des stems... (plusieurs minutes)")

    if device == "mps":
        os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

    def _apply(dev: str):
        with torch.no_grad():
            return apply_model(
                model,
                wav.to(dev)[None],
                device=dev,
                shifts=1,
                split=True,
                overlap=0.25,
                progress=False,
            )[0]

    try:
        sources = _apply(device)
    except Exception:
        if device != "cpu":
            print("⚠️ GPU failed, falling back to CPU...", flush=True)
            if progress_callback:
                progress_callback(25, "Reprise sur CPU...")
            model.to("cpu")
            sources = _apply("cpu")
        else:
            raise

    sources = sources * ref.std() + ref.mean()

    if progress_callback:
        progress_callback(82, "Sauvegarde des stems...")

    output_path = Path(output_dir)
    for i, (stem, source) in enumerate(zip(model.sources, sources)):
        dst = output_path / f"{stem}.wav"
        save_audio(source.cpu(), str(dst), samplerate=model.samplerate)
        if progress_callback:
            progress_callback(85 + i * 3, f"Compression {stem}...")
        _compress_stem_to_mp3(dst)

    if progress_callback:
        progress_callback(98, "Finalisation...")
    print(f"✅ Stems generated (MP3) in {output_dir}", flush=True)


# ── Development path: demucs subprocess ──────────────────────────────────────

def _process_via_subprocess(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
) -> None:
    """Separate stems by spawning ``python -m demucs`` (used in dev mode)."""
    python_executable = sys.executable
    device = _get_best_device()
    print(f"🎛️ Using device: {device}", flush=True)

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
            env = os.environ.copy()
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
            # tqdm outputs like "Separating track:  74%|███"
            match = re.search(r"(\d+)%", line)
            if match and progress_callback:
                pct = int(match.group(1))
                # Map Demucs 0-100% → overall 15-80%
                mapped = 15 + int(pct * 0.65)
                progress_callback(mapped, f"Séparation des stems... {pct}%")

        process.wait()
        return process.returncode, "\n".join(all_lines[-30:])

    returncode, demucs_log = run_demucs(device)

    if returncode != 0 and device == "mps":
        print("⚠️ MPS failed, falling back to CPU...", flush=True)
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
    print(f"✅ Stems generated (MP3) in {output_dir}", flush=True)


# ── Public API ────────────────────────────────────────────────────────────────

def process_audio(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
):
    """Traite un fichier audio avec Demucs et compresse les stems en MP3.

    Dispatche vers l'API Python (bundle) ou le sous-processus (dev) selon le
    contexte d'exécution.
    """
    if _is_frozen():
        # In a PyInstaller bundle sys.executable is the binary itself, not a
        # Python interpreter, so spawning `python -m demucs` would fail.
        # Use the demucs Python API directly instead.
        _process_via_api(input_path, output_dir, progress_callback)
    else:
        # Dev mode: spawn as subprocess to get real-time tqdm progress logs.
        _process_via_subprocess(input_path, output_dir, progress_callback)
