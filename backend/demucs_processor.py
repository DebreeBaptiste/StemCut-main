"""Wrapper pour Demucs - séparation audio en 4 stems.

Ce module exécute Demucs, déplace les stems générés dans le dossier du job,
et compresse chaque stem en MP3 pour réduire l'espace disque.
"""

import re
import subprocess
import shutil
import sys
from pathlib import Path
from typing import Callable, Optional

from pydub import AudioSegment


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


def process_audio(
    input_path: str,
    output_dir: str,
    progress_callback: Optional[Callable[[int, str], None]] = None,
):
    """Traite un fichier audio avec Demucs et compresse les stems en MP3."""
    python_executable = sys.executable
    device = _get_best_device()
    print(f"🎛️ Using device: {device}", flush=True)

    if progress_callback:
        progress_callback(15, f"Démarrage Demucs ({device})...")

    def run_demucs(dev: str) -> int:
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
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )

        for line in process.stderr:
            line = line.strip()
            if not line:
                continue
            # tqdm outputs like "Separating track:  74%|███"
            match = re.search(r"(\d+)%", line)
            if match and progress_callback:
                pct = int(match.group(1))
                # Map Demucs 0-100% → overall 15-80%
                mapped = 15 + int(pct * 0.65)
                progress_callback(mapped, f"Séparation des stems... {pct}%")

        process.wait()
        return process.returncode

    returncode = run_demucs(device)

    if returncode != 0 and device == "mps":
        print("⚠️ MPS failed, falling back to CPU...", flush=True)
        if progress_callback:
            progress_callback(15, "MPS indisponible, reprise sur CPU...")
        returncode = run_demucs("cpu")

    if returncode != 0:
        raise Exception(f"Demucs a échoué (code {returncode})")

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
