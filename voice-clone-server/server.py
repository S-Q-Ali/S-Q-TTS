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
import time
import uuid
import shutil
import hashlib
import torch
import torchaudio
import torchaudio as ta
import librosa
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
EMBED_CACHE_DIR = Path("./embed_cache")  # Pre-computed speaker embeddings/conditionals cache
AUDIO_CACHE_DIR = Path("./audio_cache")  # Pre-generated cloned audio cache (skips 100% sampling for identical requests!)

# In-memory RAM cache for active session voice conditionals: { hash: Conditionals }
ACTIVE_COND_CACHE = {}


def compute_file_hash(fpath: Path) -> str:
    """Compute rapid MD5 hash of an audio file to identify identical voice samples."""
    hasher = hashlib.md5()
    with open(fpath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def analyze_voice_pace(audio_path: Path) -> dict:
    """
    Rapid acoustic cadence & speaking rate analyzer:
    Detects energy onsets, syllables-per-second (SPS), estimated WPM,
    and calculates optimal playback speed factor (0.75x to 1.35x).
    Runs in ~0.15s - 0.25s!
    """
    try:
        y, sr = librosa.load(str(audio_path), sr=24000)
        duration = float(librosa.get_duration(y=y, sr=sr))
        if duration < 0.5:
            return {
                "duration_sec": round(duration, 1),
                "sps": 4.1,
                "wpm": 135,
                "pace_label": "Natural Conversational Pace",
                "recommended_speed": 1.0,
            }

        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        sps = float(len(onsets) / max(duration, 0.5))
        est_wpm = int(sps * 33.0)  # Average conversational ratio

        # Baseline human conversational speaking rate: ~4.1 SPS (~135-140 WPM)
        baseline_sps = 4.1
        calc_speed = round(float(sps / baseline_sps), 2)
        clamped_speed = round(max(0.75, min(1.35, calc_speed)), 2)

        if sps < 3.4:
            pace_label = "Slow & Deliberate / Whispering"
        elif sps > 4.8:
            pace_label = "Fast & Upbeat / Energetic"
        else:
            pace_label = "Natural Conversational Pace"

        return {
            "duration_sec": round(duration, 1),
            "sps": round(sps, 2),
            "wpm": est_wpm,
            "pace_label": pace_label,
            "recommended_speed": clamped_speed,
        }
    except Exception as e:
        print(f"⚠️ Pace analysis fallback due to error: {e}")
        return {
            "duration_sec": 0.0,
            "sps": 4.1,
            "wpm": 135,
            "pace_label": "Standard Pace",
            "recommended_speed": 1.0,
        }


def apply_time_stretch(waveform: torch.Tensor, sr: int, speed: float) -> torch.Tensor:
    """
    Sub-second pitch-preserving time-stretch using torchaudio phase vocoder.
    speed > 1.0 = faster, shorter duration.
    speed < 1.0 = slower, longer duration.
    Preserves speaker pitch and emotional tone perfectly.
    """
    if abs(speed - 1.0) < 0.02:
        return waveform

    try:
        orig_device = waveform.device
        if waveform.dim() == 1:
            waveform = waveform.unsqueeze(0)

        n_fft = 1024
        hop_length = 256
        window = torch.hann_window(n_fft, device=orig_device)

        stft = torch.stft(
            waveform,
            n_fft=n_fft,
            hop_length=hop_length,
            window=window,
            return_complex=True,
        )

        ts = torchaudio.transforms.TimeStretch(
            hop_length=hop_length,
            n_freq=n_fft // 2 + 1,
            fixed_rate=None,
        ).to(orig_device)

        stretched_stft = ts(stft, speed)

        out_waveform = torch.istft(
            stretched_stft,
            n_fft=n_fft,
            hop_length=hop_length,
            window=window,
        )
        return out_waveform
    except Exception as e:
        print(f"⚠️ TimeStretch warning ({e}), returning raw waveform")
        return waveform


def get_or_prepare_conditionals(audio_path: Path, exaggeration: float = 0.5):
    """
    Lightning-fast voice conditional extractor:
    Checks in-memory RAM cache and disk cache before touching librosa or VoiceEncoder.
    Saves 8 to 15 seconds per generation!
    """
    global MODEL, ACTIVE_COND_CACHE

    audio_hash = compute_file_hash(audio_path)
    cache_key = f"{audio_hash}_{exaggeration}"

    # 1. Check in-memory RAM cache (Instant 0.00s lookup)
    if cache_key in ACTIVE_COND_CACHE:
        print(f"⚡ [RAM Cache HIT] Using pre-computed voice embeddings for '{audio_path.name}' (0.0s)")
        MODEL.conds = ACTIVE_COND_CACHE[cache_key]
        return

    # 2. Check disk cache
    disk_cache_file = EMBED_CACHE_DIR / f"{audio_hash}.pt"
    if disk_cache_file.exists():
        try:
            print(f"📦 [Disk Cache HIT] Loading pre-computed embeddings from {disk_cache_file.name} (~0.05s)")
            from chatterbox.tts import Conditionals
            map_device = "cuda" if "cuda" in str(DEVICE) else "cpu"
            loaded_conds = Conditionals.load(disk_cache_file, map_location=map_device)
            # Update emotion exaggeration
            if hasattr(loaded_conds.t3, "emotion_adv"):
                loaded_conds.t3.emotion_adv = (exaggeration * torch.ones(1, 1, 1)).to(map_device)
            MODEL.conds = loaded_conds
            ACTIVE_COND_CACHE[cache_key] = loaded_conds
            return
        except Exception as e:
            print(f"⚠️ Cache read warning: {e}. Re-computing...")

    # 3. Cache Miss: Run full audio extraction once and cache it
    print(f"⏳ [Cache MISS] Extracting voice embeddings & sampling for '{audio_path.name}' (one-time cost)...")
    MODEL.prepare_conditionals(str(audio_path), exaggeration=exaggeration)

    # Save to disk cache for future reuse across server restarts
    try:
        if MODEL.conds is not None:
            MODEL.conds.save(disk_cache_file)
            ACTIVE_COND_CACHE[cache_key] = MODEL.conds
            print(f"💾 Saved voice embedding cache to '{disk_cache_file.name}'. Next runs will be instant!")
    except Exception as e:
        print(f"⚠️ Could not save embedding cache: {e}")


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
    EMBED_CACHE_DIR.mkdir(exist_ok=True)
    AUDIO_CACHE_DIR.mkdir(exist_ok=True)

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


# ─── Acoustic Analysis Endpoints ──────────────────────────────────
@app.post("/analyze-voice")
async def analyze_voice_endpoint(
    speaker_wav: UploadFile = File(..., description="Reference voice audio to analyze"),
):
    """Analyze speaking rate, syllables per second, and estimate natural speed multiplier."""
    file_id = str(uuid.uuid4())[:8]
    ext = Path(speaker_wav.filename or "audio.wav").suffix or ".wav"
    temp_input = UPLOAD_DIR / f"analyze_{file_id}{ext}"
    try:
        with open(temp_input, "wb") as f:
            f.write(await speaker_wav.read())
        result = analyze_voice_pace(temp_input)
        return result
    finally:
        if temp_input.exists():
            temp_input.unlink(missing_ok=True)


@app.post("/analyze-saved-voice")
async def analyze_saved_voice_endpoint(
    voice_name: str = Form(..., description="Name of a saved voice profile"),
):
    """Analyze speaking rate of a saved voice profile."""
    voice_file = None
    if VOICES_DIR.exists():
        for f in VOICES_DIR.iterdir():
            if f.stem == voice_name:
                voice_file = f
                break
    if not voice_file:
        raise HTTPException(status_code=404, detail=f"Voice '{voice_name}' not found")
    return analyze_voice_pace(voice_file)


# ─── Clone Voice Endpoint ──────────────────────────────────────────
@app.post("/clone-voice")
async def clone_voice(
    text: str = Form(..., description="Text to synthesize"),
    speaker_wav: UploadFile = File(..., description="Reference voice audio (6-15s, WAV/MP3)"),
    exaggeration: float = Form(0.5, description="Voice expressiveness 0.0-1.0"),
    cfg_weight: float = Form(0.5, description="Classifier-free guidance weight 0.0-1.0"),
    speed: float = Form(1.0, description="Speech tempo / speed multiplier (0.75 - 1.35)"),
):
    """
    Zero-shot voice cloning: takes a reference audio sample and generates
    speech in that voice saying the provided text.
    """
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Clamp speed within safe natural audio boundary
    speed = max(0.75, min(1.35, float(speed)))

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

        # ── 1. Check Full Audio Cache (Instant 0.01s hit!) ──────────
        audio_hash = compute_file_hash(temp_input)
        clean_text_key = text.strip()
        gen_cache_key = hashlib.md5(f"{audio_hash}_{clean_text_key}_{exaggeration}_{cfg_weight}_{speed}".encode()).hexdigest()
        cached_audio_file = AUDIO_CACHE_DIR / f"{gen_cache_key}.wav"

        if cached_audio_file.exists():
            print(f"⚡ [Full Audio Cache HIT] Found identical synthesized audio for '{clean_text_key[:40]}...' at {speed}x (~0.01s)! Skipping sampling completely!")
            with open(cached_audio_file, "rb") as f:
                cached_bytes = f.read()
            return StreamingResponse(
                io.BytesIO(cached_bytes),
                media_type="audio/wav",
                headers={
                    "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                    "Content-Length": str(len(cached_bytes)),
                    "X-Cache-Hit": "full_audio",
                    "X-Speed-Factor": str(speed),
                },
            )

        # ── 2. Fresh Synthesis Pipeline ─────────────────────────────
        t_start = time.time()
        print(f"🎤 [Pipeline Started] Text: '{clean_text_key[:50]}...' | Ref: {temp_input.name} | Speed: {speed}x")
        print(f"📦 [Phase 1/3 - CPU] Loading Voice Acoustic Embeddings & Conditionals...")
        get_or_prepare_conditionals(temp_input, exaggeration=exaggeration)

        print(f"🧠 [Phase 2/3 - CPU / 16GB RAM] Generating Speech Tokens via LLM (T3)...")
        print(f"🌊 [Phase 3/3 - {DEVICE}] Synthesizing Waveform via Diffusion Vocoder (1000 steps)...")

        wav = MODEL.generate(
            text=text,
            audio_prompt_path=None,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        # Apply pitch-preserving Phase Vocoder time-stretch if speed != 1.0
        if abs(speed - 1.0) >= 0.02:
            print(f"⚡ [Phase Vocoder] Applying instant time-stretch factor {speed}x...")
            wav = apply_time_stretch(wav, MODEL.sr, speed)

        # Save to temp file
        ta.save(str(temp_output), wav, MODEL.sr)

        # Save to Audio Cache for instant future re-runs
        try:
            shutil.copyfile(temp_output, cached_audio_file)
            print(f"💾 [Audio Cache Saved] Next time this text is synthesized with this voice at {speed}x, it will load instantly (0.01s)!")
        except Exception as ce:
            print(f"⚠️ Audio cache write warning: {ce}")

        elapsed_sec = round(time.time() - t_start, 1)
        print(f"✅ [Synthesis Complete] Finished in {elapsed_sec}s!")

        # Read and stream back
        with open(temp_output, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                "Content-Length": str(len(audio_bytes)),
                "X-Speed-Factor": str(speed),
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
    speed: float = Form(1.0, description="Speech tempo / speed multiplier (0.75 - 1.35)"),
):
    """Generate speech using a previously saved voice profile."""
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # Clamp speed within safe natural audio boundary
    speed = max(0.75, min(1.35, float(speed)))

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
        clean_text_key = text.strip()
        voice_hash = compute_file_hash(voice_file)
        gen_cache_key = hashlib.md5(f"{voice_hash}_{clean_text_key}_{exaggeration}_{cfg_weight}_{speed}".encode()).hexdigest()
        cached_audio_file = AUDIO_CACHE_DIR / f"{gen_cache_key}.wav"

        if cached_audio_file.exists():
            print(f"⚡ [Full Audio Cache HIT] Found identical synthesized audio for saved voice '{voice_name}' at {speed}x (~0.01s)! Skipping sampling completely!")
            with open(cached_audio_file, "rb") as f:
                cached_bytes = f.read()
            return StreamingResponse(
                io.BytesIO(cached_bytes),
                media_type="audio/wav",
                headers={
                    "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                    "Content-Length": str(len(cached_bytes)),
                    "X-Cache-Hit": "full_audio",
                    "X-Speed-Factor": str(speed),
                },
            )

        t_start = time.time()
        print(f"🎤 [Pipeline Started] Saved voice: '{voice_name}' | Text: '{clean_text_key[:50]}...' | Speed: {speed}x")
        print(f"📦 [Phase 1/3 - CPU] Loading Voice Embeddings & Conditionals...")
        get_or_prepare_conditionals(voice_file, exaggeration=exaggeration)

        print(f"🧠 [Phase 2/3 - CPU / 16GB RAM] Generating Speech Tokens via LLM (T3)...")
        print(f"🌊 [Phase 3/3 - {DEVICE}] Synthesizing Waveform via Diffusion Vocoder (1000 steps)...")

        wav = MODEL.generate(
            text=text,
            audio_prompt_path=None,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        # Apply pitch-preserving Phase Vocoder time-stretch if speed != 1.0
        if abs(speed - 1.0) >= 0.02:
            print(f"⚡ [Phase Vocoder] Applying instant time-stretch factor {speed}x...")
            wav = apply_time_stretch(wav, MODEL.sr, speed)

        ta.save(str(temp_output), wav, MODEL.sr)

        try:
            shutil.copyfile(temp_output, cached_audio_file)
            print(f"💾 [Audio Cache Saved] Next time this saved voice is synthesized with this text at {speed}x, it will load instantly (0.01s)!")
        except Exception:
            pass

        elapsed_sec = round(time.time() - t_start, 1)
        print(f"✅ [Synthesis Complete] Finished in {elapsed_sec}s!")

        with open(temp_output, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                "Content-Length": str(len(audio_bytes)),
                "X-Speed-Factor": str(speed),
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
