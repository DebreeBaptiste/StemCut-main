# Build StemCut installer (.exe) sur Windows
# Lancer depuis PowerShell : .\scripts\build-windows.ps1
$ErrorActionPreference = "Stop"

$REPO = Split-Path -Parent $PSScriptRoot

Write-Host "=== StemCut - Build Windows ==="
Write-Host "Dossier : $REPO"

# 1. Crer le venv Python si absent
$VENV = "$REPO\.venv"
if (-not (Test-Path $VENV)) {
    Write-Host ""
    Write-Host "Creation du venv Python..."
    Write-Host "   Premiere fois : ~15-30 min pour telecharger PyTorch + Demucs (~3-4 Go)"
    Write-Host ""
    python -m venv $VENV
    & "$VENV\Scripts\pip" install --upgrade pip
    # PyTorch CPU only (pas de GPU sur la plupart des machines)
    & "$VENV\Scripts\pip" install torch==2.2.0 torchaudio==2.2.0 --index-url https://download.pytorch.org/whl/cpu
    & "$VENV\Scripts\pip" install -r "$REPO\backend\requirements.txt"
    Write-Host "venv pret"
} else {
    Write-Host "venv deja present (supprimer .venv pour forcer la mise a jour)"
}

# 2. Build frontend Next.js
Write-Host ""
Write-Host "Build frontend Next.js..."
Set-Location "$REPO\frontend"
npm run build
Copy-Item -Recurse -Force ".next\static" ".next\standalone\.next\static"
if (Test-Path "public") {
    Copy-Item -Recurse -Force "public" ".next\standalone\public"
}

# 3. Packaging Electron
Write-Host ""
Write-Host "Packaging Electron..."
Set-Location $REPO
New-Item -ItemType Junction -Path "_venv" -Target $VENV -Force | Out-Null
npx electron-builder --win nsis --publish never
Remove-Item "_venv" -Force -Recurse -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Installer pret : dist\StemCut*.exe"
