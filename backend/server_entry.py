"""PyInstaller entry point for the StemCut backend.

Sets STEMCUT_STORAGE to a stable user-writable path before the app module
is imported, so main.py writes job data outside _MEIPASS.
"""
import os
import sys
import tempfile
import traceback
from pathlib import Path
import datetime

# Early startup log — written to %TEMP% so it exists even if the app crashes
# before creating the STEMCUT_STORAGE directory.
_startup_log = Path(tempfile.gettempdir()) / "stemcut_startup.log"
def _slog(msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{ts}  {msg}\n"
    print(line, end="", flush=True)
    try:
        with open(_startup_log, "a", encoding="utf-8") as _f:
            _f.write(line)
    except Exception:
        pass

_slog(f"=== StemCut backend starting (python {sys.version}) ===")
_slog(f"frozen={getattr(sys, 'frozen', False)}, platform={sys.platform}")

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
_slog(f"storage dir: {_storage}")

_slog("importing uvicorn...")
import uvicorn
_slog("uvicorn imported")

_slog("importing main app...")
try:
    from main import app  # noqa: E402  (must come after env setup)
    _slog("main app imported OK")
except Exception as _e:
    _slog(f"FATAL during 'from main import app': {_e}")
    _slog(traceback.format_exc())
    raise

if __name__ == "__main__":
    _slog("starting uvicorn on 127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
