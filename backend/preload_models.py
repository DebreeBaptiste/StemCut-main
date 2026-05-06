#!/usr/bin/env python
"""Pre-download Demucs models to include in PyInstaller bundle.

This script ensures the htdemucs model is cached before building the binary,
so users don't need to download ~450 Mo on first run (Windows issue fix).

Run this before PyInstaller build:
  python backend/preload_models.py
"""

import os
import sys
from pathlib import Path

def preload_demucs_model():
    """Download htdemucs model to cache directory."""
    print("📦 Preloading Demucs htdemucs model...")
    
    # Set up cache directory explicitly
    cache_dir = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Force torch to use this cache directory
    os.environ['TORCH_HOME'] = str(Path.home() / ".cache" / "torch")
    
    try:
        print(f"   Cache directory: {cache_dir}")
        
        # Import and download model
        from demucs.pretrained import get_model
        import torch
        
        # This will download the model if not cached
        print("   Downloading model...")
        model = get_model('htdemucs')
        print(f"   ✅ Model cached successfully: {model}")
        
        # Verify cache
        cached_files = list(cache_dir.glob("htdemucs*"))
        if cached_files:
            print(f"   ✅ Cached files: {len(cached_files)} file(s)")
            for f in cached_files:
                size_mb = f.stat().st_size / (1024 * 1024)
                print(f"      - {f.name} ({size_mb:.1f} MB)")
        else:
            print("   ⚠️  No cached files found after download!")
            return False
            
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = preload_demucs_model()
    sys.exit(0 if success else 1)
