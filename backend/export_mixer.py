"""Mixe les stems selon les préférences utilisateur."""
from pydub import AudioSegment
from pathlib import Path
from typing import List


def _find_stem_file(job_dir: Path, stem_name: str) -> Path:
    """Retourne le fichier de stem (MP3 ou WAV) s'il existe."""
    mp3_path = job_dir / f"{stem_name}.mp3"
    wav_path = job_dir / f"{stem_name}.wav"

    if mp3_path.exists():
        return mp3_path
    if wav_path.exists():
        return wav_path

    raise FileNotFoundError(f"Stem {stem_name} not found")


def create_mix(job_dir: str, muted_stems: List[str]) -> str:
    """Crée un mix MP3 en excluant les stems mutés.

    Args:
        job_dir: Dossier contenant les stems
        muted_stems: Liste des stems à exclure (ex: ["bass", "vocals"])

    Returns:
        Chemin du fichier MP3 généré
    """
    all_stems = ["vocals", "drums", "bass", "other"]
    active_stems = [s for s in all_stems if s not in muted_stems]

    if not active_stems:
        raise ValueError("Cannot export with all stems muted")

    # Charger et mixer les stems actifs (MP3 ou WAV)
    mix = None
    job_path = Path(job_dir)

    for stem in active_stems:
        stem_path = _find_stem_file(job_path, stem)

        audio = AudioSegment.from_file(str(stem_path))

        if mix is None:
            mix = audio
        else:
            mix = mix.overlay(audio)

    # Exporter en MP3
    output_path = job_path / "export.mp3"
    mix.export(str(output_path), format="mp3", bitrate="320k")

    print(f"✅ Mix exported to {output_path}")
    return str(output_path)
