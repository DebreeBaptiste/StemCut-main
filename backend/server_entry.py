"""Entry point for the StemCut backend when packaged with PyInstaller.

When running as a frozen bundle this module:
  - Adds ``sys._MEIPASS`` to ``sys.path`` so that the bundled modules
    (``main``, ``demucs_processor``, ``export_mixer``) are importable.
  - Sets the ``STEMCUT_STORAGE`` environment variable to a writable
    per-user directory so that the FastAPI app can store job data.
  - Launches uvicorn serving the FastAPI app on 127.0.0.1:8000.

In development the module is never used directly; ``uvicorn main:app``
is invoked by the developer (or by the dev Electron path) as before.
"""

import os
import sys
from pathlib import Path


def _setup_environment() -> None:
    """Configure paths and environment variables for bundled execution."""
    is_frozen = getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")
    if not is_frozen:
        return

    meipass = Path(sys._MEIPASS)

    # Ensure bundled modules (main.py, demucs_processor.py, …) are importable.
    if str(meipass) not in sys.path:
        sys.path.insert(0, str(meipass))

    # Persistent storage: ~/Library/Application Support/StemCut/storage/
    home = os.environ.get("HOME", str(Path.home()))
    storage_dir = (
        Path(home) / "Library" / "Application Support" / "StemCut" / "storage"
    )
    storage_dir.mkdir(parents=True, exist_ok=True)
    os.environ["STEMCUT_STORAGE"] = str(storage_dir)

    # Guard against missing baseline env vars (Electron sets these but be safe).
    os.environ.setdefault("HOME", home)
    os.environ.setdefault(
        "TMPDIR", os.environ.get("TMPDIR", str(Path(home) / "tmp"))
    )


def main() -> None:
    _setup_environment()

    import uvicorn
    from main import app

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        reload=False,
        workers=1,
    )


if __name__ == "__main__":
    main()
