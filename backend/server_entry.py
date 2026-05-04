"""PyInstaller entry point for the StemCut backend.

Sets STEMCUT_STORAGE to a stable user-writable path before the app module
is imported, so main.py writes job data outside _MEIPASS.
"""
import os
import sys
from pathlib import Path

# Resolve stable storage directory before importing the app.
# On macOS this becomes ~/Library/Application Support/StemCut/storage/
if sys.platform == "darwin":
    _storage = Path.home() / "Library" / "Application Support" / "StemCut" / "storage"
else:
    _storage = Path.home() / ".stemcut" / "storage"

_storage.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("STEMCUT_STORAGE", str(_storage))

import uvicorn
from main import app  # noqa: E402  (must come after env setup)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
