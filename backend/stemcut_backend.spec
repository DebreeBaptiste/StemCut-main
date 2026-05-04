# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for stemcut-backend.

Builds a self-contained onedir bundle that includes the FastAPI backend,
demucs, PyTorch, yt-dlp, and all other dependencies.

Build from the backend/ directory (handled automatically by the build scripts):

    # macOS arm64 (native Apple Silicon)
    bash scripts/build-backend-mac.sh

    # macOS x64 (Intel / Rosetta from Apple Silicon)
    bash scripts/build-backend-mac-x64.sh

The resulting bundle is placed in <repo-root>/dist-backend/stemcut-backend/
and is picked up by electron-builder via the extraResources config in
package.json.
"""

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

# ── Collect all sub-modules and data for packages with many dynamic imports ──

torch_datas, torch_binaries, torch_hiddenimports = collect_all("torch")
torchaudio_datas, torchaudio_binaries, torchaudio_hiddenimports = collect_all(
    "torchaudio"
)
demucs_datas, demucs_binaries, demucs_hiddenimports = collect_all("demucs")
yt_dlp_datas, yt_dlp_binaries, yt_dlp_hiddenimports = collect_all("yt_dlp")

all_datas = (
    torch_datas
    + torchaudio_datas
    + demucs_datas
    + yt_dlp_datas
    + collect_data_files("imageio_ffmpeg")
    + collect_data_files("soundfile")
)

all_binaries = (
    torch_binaries
    + torchaudio_binaries
    + demucs_binaries
    + yt_dlp_binaries
)

all_hiddenimports = (
    torch_hiddenimports
    + torchaudio_hiddenimports
    + demucs_hiddenimports
    + yt_dlp_hiddenimports
    + collect_submodules("uvicorn")
    + collect_submodules("fastapi")
    + collect_submodules("pydantic")
    + collect_submodules("starlette")
    + collect_submodules("multipart")
    + [
        # Local backend modules
        "demucs_processor",
        "export_mixer",
        # Audio / ML
        "soundfile",
        "imageio_ffmpeg",
        "pydub",
        # Async I/O (uvicorn deps)
        "anyio",
        "anyio.abc",
        "anyio._backends._asyncio",
        "aiofiles",
        # stdlib extras sometimes missed
        "email.mime.text",
        "email.mime.multipart",
    ]
)

# ── Analysis ──────────────────────────────────────────────────────────────────

a = Analysis(
    ["server_entry.py"],
    # pathex=["."] so that local modules (main.py, demucs_processor.py, …)
    # are found when running pyinstaller from the backend/ directory.
    pathex=["."],
    binaries=all_binaries,
    datas=all_datas,
    hiddenimports=all_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# ── Executable ────────────────────────────────────────────────────────────────

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="stemcut-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # UPX compression is disabled — it can break macOS code-signing.
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    # target_arch=None → use the host architecture (arm64 or x86_64).
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ── Collect (onedir bundle) ───────────────────────────────────────────────────

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="stemcut-backend",
)
