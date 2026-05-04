# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the StemCut backend binary.
# Build with: pyinstaller stemcut_backend.spec --distpath ../dist-backend --workpath ../build-backend --noconfirm
from PyInstaller.utils.hooks import collect_all, collect_data_files

block_cipher = None

torch_datas, torch_binaries, torch_hiddenimports = collect_all('torch')
torchaudio_datas, torchaudio_binaries, torchaudio_hiddenimports = collect_all('torchaudio')
demucs_datas, demucs_binaries, demucs_hiddenimports = collect_all('demucs')
ytdlp_datas, ytdlp_binaries, ytdlp_hiddenimports = collect_all('yt_dlp')

imageio_ffmpeg_datas = collect_data_files('imageio_ffmpeg')
soundfile_datas = collect_data_files('soundfile')
certifi_datas = collect_data_files('certifi')

a = Analysis(
    ['server_entry.py'],
    pathex=['.'],
    binaries=torch_binaries + torchaudio_binaries + demucs_binaries + ytdlp_binaries,
    datas=(
        torch_datas + torchaudio_datas + demucs_datas + ytdlp_datas
        + imageio_ffmpeg_datas + soundfile_datas + certifi_datas
    ),
    hiddenimports=(
        torch_hiddenimports + torchaudio_hiddenimports
        + demucs_hiddenimports + ytdlp_hiddenimports
        + [
            'certifi',
            'uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
            'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
            'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.http.httptools_impl',
            'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
            'uvicorn.protocols.websockets.websockets_impl',
            'uvicorn.protocols.websockets.wsproto_impl',
            'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.lifespan.off',
            'fastapi', 'fastapi.middleware', 'fastapi.middleware.cors',
            'pydantic', 'pydantic.v1',
            'pydub', 'soundfile', 'imageio_ffmpeg',
            'demucs.pretrained', 'demucs.apply', 'demucs.audio',
            'demucs.htdemucs', 'demucs.hdemucs', 'demucs.states',
            'tqdm', 'julius', 'lameenc', 'openunmix',
            'main', 'demucs_processor', 'export_mixer',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='stemcut-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='stemcut-backend',
)
