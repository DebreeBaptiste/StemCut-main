"""PyInstaller entry point for the StemCut backend.

Sets STEMCUT_STORAGE to a stable user-writable path before the app module
is imported, so main.py writes job data outside _MEIPASS.
"""
import os
import sys
from pathlib import Path

# In a frozen PyInstaller bundle the system SSL certificates are not available.
# Point Python's SSL stack to certifi's bundle before any network call is made.
if getattr(sys, 'frozen', False):
    import certifi
    _ca = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", _ca)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _ca)

    # Prevent OpenMP/MKL thread spawning deadlocks in frozen PyInstaller binaries
    for _var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS",
                 "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ.setdefault(_var, "1")

    # Prevent MPS (Apple Silicon GPU) initialization crashes in frozen binary
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    os.environ.setdefault("PYTORCH_MPS_HIGH_WATERMARK_RATIO", "0.0")
    # Force CPU — MPS in a frozen PyInstaller binary is unstable
    os.environ.setdefault("STEMCUT_FORCE_CPU", "1")

# Resolve stable storage directory before importing the app.
# Electron overrides this via STEMCUT_STORAGE; this fallback is for edge cases.
if sys.platform == "darwin":
    _storage = Path.home() / "Library" / "Application Support" / "StemCut" / "storage"
elif sys.platform == "win32":
    _appdata = Path(os.environ.get("APPDATA", "")) or Path.home()
    _storage = _appdata / "StemCut" / "storage"
else:
    _storage = Path.home() / ".stemcut" / "storage"

_storage.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("STEMCUT_STORAGE", str(_storage))

import uvicorn
from main import app  # noqa: E402  (must come after env setup)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
