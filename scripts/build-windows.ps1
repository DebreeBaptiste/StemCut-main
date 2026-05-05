# Build StemCut installer (.exe) sur Windows
# Lancer depuis PowerShell : .\scripts\build-windows.ps1
$ErrorActionPreference = "Stop"

$REPO = Split-Path -Parent $PSScriptRoot
$VENV = "$REPO\.venv"

Write-Host "=== StemCut - Build Windows ==="
Write-Host "Dossier : $REPO"

# 1. Venv Python (pour faire tourner PyInstaller - pas bundlé dans l'app)
if (-not (Test-Path $VENV)) {
    Write-Host ""
    Write-Host "Creation du venv Python..."
    Write-Host "   Premiere fois : ~15-30 min pour telecharger PyTorch + Demucs (~3-4 Go)"
    Write-Host ""
    python -m venv $VENV
    & "$VENV\Scripts\pip" install --upgrade pip
    & "$VENV\Scripts\pip" install torch==2.2.0 torchaudio==2.2.0 --index-url https://download.pytorch.org/whl/cpu
    & "$VENV\Scripts\pip" install -r "$REPO\backend\requirements.txt"
    & "$VENV\Scripts\pip" install pyinstaller
    Write-Host "venv pret"
} else {
    Write-Host "venv deja present - sync requirements..."
    & "$VENV\Scripts\pip" install -q -r "$REPO\backend\requirements.txt"
    $piCheck = & "$VENV\Scripts\python" -c "import PyInstaller" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installation de PyInstaller..."
        & "$VENV\Scripts\pip" install pyinstaller
    }
}

# 2. Build backend autonome avec PyInstaller
Write-Host ""
Write-Host "Build backend PyInstaller..."
Set-Location "$REPO\backend"
& "$VENV\Scripts\pyinstaller" stemcut_backend.spec `
    --distpath "$REPO\dist-backend" `
    --workpath "$REPO\build-backend" `
    --noconfirm

if (-not (Test-Path "$REPO\dist-backend\stemcut-backend\stemcut-backend.exe")) {
    Write-Error "PyInstaller a echoue : stemcut-backend.exe introuvable"
}
Write-Host "Backend pret : $REPO\dist-backend\stemcut-backend\"

# 3. Build frontend Next.js
Write-Host ""
Write-Host "Build frontend Next.js..."
Set-Location "$REPO\frontend"
npm run build
Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
if (Test-Path "public") {
    Copy-Item -Recurse -Force "public" ".next\standalone\public"
}

# 4. Packaging Electron
Write-Host ""
Write-Host "Packaging Electron..."
Set-Location $REPO
npm ci
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx electron-builder --win nsis --publish never

$installer = Get-ChildItem -Path "$REPO\dist" -Filter "StemCut*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($installer) {
    Write-Host ""
    Write-Host "Installer pret : $($installer.FullName)"
} else {
    Write-Error "Build echoue : aucun .exe trouve dans dist\"
}
