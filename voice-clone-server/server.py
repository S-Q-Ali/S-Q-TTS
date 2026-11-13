"""
S-Q-TTS Voice Clone Server
===========================
Local FastAPI microservice for zero-shot voice cloning using Chatterbox TTS.
Runs on localhost:8001, called by the Next.js frontend via /api/clone proxy.

Usage:
  python server.py
  # or: uvicorn server:app --host 0.0.0.0 --port 8001
"""

import os
import io
import uuid
import shutil
import torch
import torchaudio as ta
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ─── Model Cache Directory (Local Project Folder) ─────────────────
# Lock model downloads directly inside the project directory: E:\Web App\TTS App\voice-clone-server\models_cache
MODELS_CACHE_DIR = Path(__file__).parent / "models_cache"
MODELS_CACHE_DIR.mkdir(exist_ok=True)
os.environ["HF_HOME"] = str(MODELS_CACHE_DIR.resolve())
os.environ["TORCH_HOME"] = str(MODELS_CACHE_DIR.resolve())

# ─── Globals ────────────────────────────────────────────────────────
MODEL = None
DEVICE = None
UPLOAD_DIR = Path("./temp_uploads")
OUTPUT_DIR = Path("./temp_outputs")
VOICES_DIR = Path("./saved_voices")  # Saved reference voice profiles


# ─── Lifespan (model loading) ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Chatterbox model once at startup."""
    global MODEL, DEVICE

    # Enable expandable segments to combat fragmentation on low VRAM GPUs
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

    # Detect device and attempt smart CPU/GPU auto-offload
    if torch.cuda.is_available():
        DEVICE = "cuda"
        gpu_name = torch.cuda.get_device_name(0)
        gpu_vram = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
        print(f"Detected GPU: {gpu_name} ({gpu_vram} GB VRAM)")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        DEVICE = "mps"
    else:
        DEVICE = "cpu"

    print(f"╔══════════════════════════════════════════╗")
    print(f"║  S-Q-TTS Voice Clone Server              ║")
    print(f"║  Target Device: {DEVICE:<25s}║")
    print(f"╚══════════════════════════════════════════╝")
    print("Loading Chatterbox TTS model...")

    from chatterbox.tts import ChatterboxTTS

    # Try smart loading:
    # 1. Full GPU (Fastest)
    # 2. Pipeline Split: t3 (Text-to-Token LLM) on CPU + s3gen (Diffusion Waveform Vocoder) on GPU
    # 3. Full CPU + 16GB RAM (Safe Fallback)
    try:
        if DEVICE == "cuda":
            print("⚡ Step 1: Testing Full GPU loading (CUDA)...")
            MODEL = ChatterboxTTS.from_pretrained(device="cuda")
            print("🚀 Success: Model running 100% on GPU!")
        else:
            MODEL = ChatterboxTTS.from_pretrained(device="cpu")
            print("✅ Success: Model running on CPU mode.")
    except RuntimeError as cuda_err:
        if "out of memory" in str(cuda_err).lower() or "cuda" in str(cuda_err).lower():
            print("⚠️ 2GB VRAM was too tight for full model. Attempting TRUE HYBRID (CPU + GPU Pipeline)...")
            torch.cuda.empty_cache()
            try:
                # Load on CPU first
                MODEL = ChatterboxTTS.from_pretrained(device="cpu")
                
                # Split Pipeline: Offload s3gen (vocoder/audio diffusion) to GPU MX250
                # Keep t3 (heavy LLM text transformer) in 16GB CPU RAM
                if hasattr(MODEL, "s3gen"):
                    print("⚡ Moving s3gen (Diffusion Vocoder) to NVIDIA MX250 GPU...")
                    MODEL.s3gen = MODEL.s3gen.to("cuda")
                    DEVICE = "cuda+cpu (hybrid)"
                    print("🚀 TRUE HYBRID ACTIVATED: CPU handles Text Tokens + GPU synthesizes Audio Waveform simultaneously!")
                else:
                    DEVICE = "cpu"
                    print("✅ Running in CPU mode with 16GB RAM.")
            except Exception as hybrid_err:
                print(f"⚠️ Hybrid split exception ({hybrid_err}). Reverting safely to pure CPU...")
                torch.cuda.empty_cache()
                DEVICE = "cpu"
                MODEL = ChatterboxTTS.from_pretrained(device="cpu")
                print("✅ Running stable on CPU mode.")
        else:
            raise cuda_err

    print("✅ Model loaded successfully!")

    # Ensure directories exist
    UPLOAD_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    VOICES_DIR.mkdir(exist_ok=True)

    yield  # App runs

    # Cleanup on shutdown
    print("Shutting down... cleaning temp files.")
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR, ignore_errors=True)
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR, ignore_errors=True)


# ─── App ────────────────────────────────────────────────────────────
app = FastAPI(
    title="S-Q-TTS Voice Clone Server",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ───────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": MODEL is not None,
        "device": DEVICE,
    }


# ─── Clone Voice Endpoint ──────────────────────────────────────────
@app.post("/clone-voice")
async def clone_voice(
    text: str = Form(..., description="Text to synthesize"),
    speaker_wav: UploadFile = File(..., description="Reference voice audio (6-15s, WAV/MP3)"),
    exaggeration: float = Form(0.5, description="Voice expressiveness 0.0-1.0"),
    cfg_weight: float = Form(0.5, description="Classifier-free guidance weight 0.0-1.0"),
):
    """
    Zero-shot voice cloning: takes a reference audio sample and generates
    speech in that voice saying the provided text.
    """
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Save uploaded file temporarily
    file_id = str(uuid.uuid4())[:8]
    ext = Path(speaker_wav.filename or "audio.wav").suffix or ".wav"
    temp_input = UPLOAD_DIR / f"ref_{file_id}{ext}"
    temp_output = OUTPUT_DIR / f"out_{file_id}.wav"

    try:
        # Write uploaded audio to disk
        with open(temp_input, "wb") as f:
            content = await speaker_wav.read()
            f.write(content)

        print(f"🎤 Cloning voice | Text: '{text[:60]}...' | Ref: {temp_input.name}")

        # Generate cloned speech
        wav = MODEL.generate(
            text=text,
            audio_prompt_path=str(temp_input),
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        # Save to temp file
        ta.save(str(temp_output), wav, MODEL.sr)

        # Read and stream back
        with open(temp_output, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                "Content-Length": str(len(audio_bytes)),
            },
        )

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

    finally:
        # Cleanup temp files
        if temp_input.exists():
            temp_input.unlink(missing_ok=True)
        if temp_output.exists():
            temp_output.unlink(missing_ok=True)


# ─── Save Voice Profile ────────────────────────────────────────────
@app.post("/save-voice")
async def save_voice(
    name: str = Form(..., description="Name for this voice profile"),
    speaker_wav: UploadFile = File(..., description="Reference voice audio"),
):
    """Save a reference voice for reuse without re-uploading."""
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_ ").strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid voice name")

    ext = Path(speaker_wav.filename or "audio.wav").suffix or ".wav"
    voice_path = VOICES_DIR / f"{safe_name}{ext}"

    with open(voice_path, "wb") as f:
        f.write(await speaker_wav.read())

    return {"status": "saved", "name": safe_name, "path": str(voice_path)}


# ─── List Saved Voices ─────────────────────────────────────────────
@app.get("/voices")
async def list_voices():
    """List all saved voice profiles."""
    voices = []
    if VOICES_DIR.exists():
        for f in VOICES_DIR.iterdir():
            if f.suffix.lower() in (".wav", ".mp3", ".flac", ".ogg"):
                voices.append({
                    "name": f.stem,
                    "filename": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 1),
                })
    return {"voices": voices}


# ─── Clone with Saved Voice ────────────────────────────────────────
@app.post("/clone-saved")
async def clone_with_saved_voice(
    text: str = Form(...),
    voice_name: str = Form(..., description="Name of a previously saved voice"),
    exaggeration: float = Form(0.5),
    cfg_weight: float = Form(0.5),
):
    """Generate speech using a previously saved voice profile."""
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # Find the saved voice file
    voice_file = None
    for f in VOICES_DIR.iterdir():
        if f.stem == voice_name:
            voice_file = f
            break

    if not voice_file:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found")

    file_id = str(uuid.uuid4())[:8]
    temp_output = OUTPUT_DIR / f"out_{file_id}.wav"

    try:
        print(f"🎤 Using saved voice '{voice_name}' | Text: '{text[:60]}...'")

        wav = MODEL.generate(
            text=text,
            audio_prompt_path=str(voice_file),
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        ta.save(str(temp_output), wav, MODEL.sr)

        with open(temp_output, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                "Content-Length": str(len(audio_bytes)),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")
    finally:
        if temp_output.exists():
            temp_output.unlink(missing_ok=True)


# ─── Entry Point ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("Starting S-Q-TTS Voice Clone Server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
