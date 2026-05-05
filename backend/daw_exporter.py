"""Create DAW-ready export packs from separated stems.

The pack contains aligned WAV stems, metadata, and a short import guide.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional
import json
import zipfile

from pydub import AudioSegment


STEM_NAMES = ["vocals", "drums", "bass", "other"]


def _find_stem_file(job_dir: Path, stem_name: str) -> Path:
    """Return stem file path (MP3 or WAV) if present."""
    mp3_path = job_dir / f"{stem_name}.mp3"
    wav_path = job_dir / f"{stem_name}.wav"

    if wav_path.exists():
        return wav_path
    if mp3_path.exists():
        return mp3_path

    raise FileNotFoundError(f"Stem {stem_name} not found")


def _load_bpm_data(job_dir: Path) -> Dict[str, Optional[float]]:
    bpm_file = job_dir / "bpm.json"
    if not bpm_file.exists():
        return {"bpm": None, "first_beat": None}

    try:
        with open(bpm_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "bpm": data.get("bpm"),
            "first_beat": data.get("first_beat"),
        }
    except Exception:
        return {"bpm": None, "first_beat": None}


def _write_aligned_wavs(job_dir: Path, export_dir: Path) -> List[str]:
    """Export all stems as aligned 24-bit WAV files and return file names."""
    loaded: Dict[str, AudioSegment] = {}
    for stem in STEM_NAMES:
        stem_path = _find_stem_file(job_dir, stem)
        loaded[stem] = AudioSegment.from_file(str(stem_path))

    max_len_ms = max(len(seg) for seg in loaded.values())
    exported_files: List[str] = []

    for stem in STEM_NAMES:
        audio = loaded[stem]
        if len(audio) < max_len_ms:
            audio += AudioSegment.silent(duration=(max_len_ms - len(audio)))

        out_name = f"{stem}.wav"
        out_path = export_dir / out_name
        audio.export(str(out_path), format="wav", parameters=["-acodec", "pcm_s24le"])
        exported_files.append(out_name)

    return exported_files


def _write_readme(export_dir: Path) -> None:
    text = """StemCut - DAW Export Pack

This pack is ready for GarageBand, Logic Pro, Ableton Live, Reaper, and other DAWs.

Contents
- vocals.wav
- drums.wav
- bass.wav
- other.wav
- metadata.json

Import instructions
1. Create a new empty project in your DAW.
2. Import all WAV files at timeline start (bar 1, beat 1 or 00:00).
3. Keep the original sample rate if your DAW asks for conversion.
4. Optionally set project tempo using metadata.json (bpm).

Notes
- All stems are aligned and have the same duration.
- Files are exported as 24-bit WAV for editing headroom.
"""
    with open(export_dir / "README_import.txt", "w", encoding="utf-8") as f:
        f.write(text)


def create_daw_export(job_dir: str, job_id: str) -> str:
    """Create a DAW-ready ZIP export for a job and return zip path."""
    job_path = Path(job_dir)
    export_dir = job_path / "daw_export"
    export_dir.mkdir(parents=True, exist_ok=True)

    stems_files = _write_aligned_wavs(job_path, export_dir)
    _write_readme(export_dir)

    bpm_data = _load_bpm_data(job_path)
    metadata = {
        "job_id": job_id,
        "format": "daw_export_v1",
        "stems": stems_files,
        "bpm": bpm_data.get("bpm"),
        "first_beat": bpm_data.get("first_beat"),
    }
    with open(export_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    zip_path = job_path / "daw_export.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for filename in stems_files:
            zf.write(export_dir / filename, arcname=filename)
        zf.write(export_dir / "metadata.json", arcname="metadata.json")
        zf.write(export_dir / "README_import.txt", arcname="README_import.txt")

    return str(zip_path)
