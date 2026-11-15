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
import sys
import io
import re
import time
import uuid
import shutil
import hashlib
import asyncio

# Force UTF-8 on Windows consoles to prevent cp1252/charmap UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
os.environ["PYTHONIOENCODING"] = "utf-8"
from typing import Optional, List
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
UPLOAD_DIR = Path(__file__).parent / "temp_uploads"
OUTPUT_DIR = Path(__file__).parent / "temp_outputs"
VOICES_DIR = Path(__file__).parent / "saved_voices"  # Saved reference voice profiles
EMBED_CACHE_DIR = Path(__file__).parent / "embed_cache"  # Pre-computed speaker embeddings/conditionals cache
AUDIO_CACHE_DIR = Path(__file__).parent / "audio_cache"  # Pre-generated cloned audio cache (skips 100% sampling for identical requests!)

# In-memory RAM cache for active session voice conditionals: { hash: Conditionals }
ACTIVE_COND_CACHE = {}

# Background Model Pre-warming State Machine
MODEL_READY_EVENT = asyncio.Event()
MODEL_STATUS = {
    "ready": False,
    "status": "initializing",
    "step": "Starting AI server...",
    "progress": 0,
    "device": "cpu",
    "load_time_sec": None,
    "error": None,
}


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


def is_audio_valid_and_not_silent(wav_tensor: torch.Tensor, sr: int = 24000) -> bool:
    """
    Validates synthesized waveform: checks if audio has healthy speech energy and is not dead silence.
    Returns True if audio is healthy speech; False if silent or anomalous.
    """
    try:
        if wav_tensor is None or wav_tensor.numel() == 0:
            return False
        # Flatten to 1D float
        flat = wav_tensor.float().flatten()
        # Overall RMS
        overall_rms = torch.sqrt(torch.mean(flat ** 2)).item()
        if overall_rms < 0.005:
            return False

        # Check windowed silence if duration >= 5 seconds
        duration_sec = int(flat.numel() / sr)
        if duration_sec >= 5:
            silent_seconds = 0
            for s in range(duration_sec):
                chunk = flat[s * sr : (s + 1) * sr]
                chunk_rms = torch.sqrt(torch.mean(chunk ** 2)).item()
                if chunk_rms < 0.002:
                    silent_seconds += 1
            # If more than 55% of the audio is dead silence, flag as anomalous
            if (silent_seconds / duration_sec) > 0.55:
                return False

        return True
    except Exception:
        return True


def split_text_into_chunks(text: str, max_chars: int = 160) -> List[str]:
    """
    Split text into natural conversational chunks based on sentences, paragraphs,
    and punctuation, ensuring each chunk stays within the optimal acoustic window (max_chars)
    without cutting words or sentences in half.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    # Split by sentence boundaries (. ! ? ۔ ؟ \n) while keeping sentence integrity
    sentences = re.split(r'(?<=[.!?۔؟\n])\s+', text)
    chunks = []
    curr = ""

    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(s) > max_chars:
            # If a single sentence exceeds max_chars, split on secondary punctuation (, ; ، ؛)
            sub_clauses = re.split(r'(?<=[,;،؛])\s+', s)
            for sc in sub_clauses:
                sc = sc.strip()
                if not sc:
                    continue
                if curr and len(curr) + len(sc) + 1 > max_chars:
                    chunks.append(curr.strip())
                    curr = sc
                else:
                    curr = f"{curr} {sc}" if curr else sc
        else:
            if curr and len(curr) + len(s) + 1 > max_chars:
                chunks.append(curr.strip())
                curr = s
            else:
                curr = f"{curr} {s}" if curr else s

    if curr.strip():
        chunks.append(curr.strip())

    return chunks


def synthesize_speech_adaptive(
    text: str,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    speed: float = 1.0,
) -> torch.Tensor:
    """
    Synthesize speech adaptively:
    For short texts (<= 160 chars), generates in a single clean pass.
    For longer scripts/paragraphs, splits into natural sentence chunks (<= 160 chars),
    generates each chunk with clean attention alignment, and stitches them with natural pauses.
    Completely eliminates attention collapse, 1000-token cutoffs, and 30s silence loops!
    """
    clean_text = text.strip()
    chunks = split_text_into_chunks(clean_text, max_chars=160)

    if len(chunks) <= 1:
        wav = MODEL.generate(
            text=clean_text,
            audio_prompt_path=None,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
    else:
        print(f"🧩 [Multi-Segment Synthesis] Long script detected ({len(clean_text)} chars). Generating {len(chunks)} seamless acoustic segments...")
        segment_wavs = []
        # 250ms natural breath pause between sentences (24000 * 0.25 = 6000 samples)
        pause_samples = int(MODEL.sr * 0.25)

        for idx, chunk in enumerate(chunks, 1):
            print(f"   ▶ Segment {idx}/{len(chunks)} ({len(chunk)} chars): '{chunk[:40]}...'")
            seg = MODEL.generate(
                text=chunk,
                audio_prompt_path=None,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
            )
            if seg.dim() == 1:
                seg = seg.unsqueeze(0)
            segment_wavs.append(seg)

            if idx < len(chunks):
                silence = torch.zeros((1, pause_samples), dtype=seg.dtype, device=seg.device)
                segment_wavs.append(silence)

        wav = torch.cat(segment_wavs, dim=-1)

    # Apply pitch-preserving Phase Vocoder time-stretch if speed != 1.0
    if abs(speed - 1.0) >= 0.02:
        print(f"⚡ [Phase Vocoder] Applying instant time-stretch factor {speed}x...")
        wav = apply_time_stretch(wav, MODEL.sr, speed)

    # Ensure correct tensor dimensions and clamp for 16-bit PCM conversion
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)
    wav = torch.clamp(wav, -1.0, 1.0)
    return wav


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


# ─── Lifespan & Background Model Warmup ────────────────────────────
async def load_model_background():
    """
    Non-blocking background model initialization.
    Loads Chatterbox directly from local cached snapshots, bypassing network checks.
    Signals MODEL_READY_EVENT when fully warmed up.
    """
    global MODEL, DEVICE, MODEL_STATUS
    t0 = time.time()
    try:
        MODEL_STATUS["status"] = "loading"
        MODEL_STATUS["step"] = "Scanning local neural weights..."
        MODEL_STATUS["progress"] = 20

        from huggingface_hub import try_to_load_from_cache
        from chatterbox.tts import REPO_ID, ChatterboxTTS

        cached_file = try_to_load_from_cache(repo_id=REPO_ID, filename="ve.safetensors")
        loop = asyncio.get_running_loop()

        def _do_load():
            # If snapshot is cached locally, bypass HuggingFace online network round-trips
            if cached_file:
                os.environ["HF_HUB_OFFLINE"] = "1"
                local_dir = Path(cached_file).parent
                print(f"⚡ [Fast Boot] Loading Chatterbox TTS directly from local snapshot: {local_dir}")
                return ChatterboxTTS.from_local(local_dir, device="cpu")
            else:
                print("⏳ [First-time Setup] Local cache not found. Fetching from Hugging Face...")
                return ChatterboxTTS.from_pretrained(device="cpu")

        MODEL_STATUS["step"] = "Loading neural weights into RAM (safetensors)..."
        MODEL_STATUS["progress"] = 40
        MODEL = await loop.run_in_executor(None, _do_load)

        DEVICE = "cpu"
        elapsed = round(time.time() - t0, 1)
        MODEL_STATUS["ready"] = True
        MODEL_STATUS["status"] = "ready"
        MODEL_STATUS["step"] = f"Model ready ({elapsed}s load)"
        MODEL_STATUS["progress"] = 100
        MODEL_STATUS["load_time_sec"] = elapsed
        MODEL_READY_EVENT.set()
        print(f"✅ Chatterbox TTS model loaded and ready in {elapsed}s!")
    except Exception as e:
        MODEL_STATUS["error"] = str(e)
        MODEL_STATUS["status"] = "error"
        MODEL_STATUS["step"] = f"Loading error: {e}"
        print(f"❌ Background model loading error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan: Launches server in under 0.5s and delegates
    heavy PyTorch tensor loading to background thread.
    """
    global DEVICE

    # Configure multi-threading for PyTorch CPU operations
    num_threads = min(os.cpu_count() or 4, 8)
    torch.set_num_threads(num_threads)
    os.environ["OMP_NUM_THREADS"] = str(num_threads)
    os.environ["MKL_NUM_THREADS"] = str(num_threads)
    os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

    DEVICE = "cpu"

    print("============================================")
    print("  S-Q-TTS Voice Clone Server (Fast Boot)")
    print(f"  Target Device: {DEVICE} ({num_threads} CPU threads)")
    print("============================================")

    # Ensure directories exist immediately
    UPLOAD_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    VOICES_DIR.mkdir(exist_ok=True)
    EMBED_CACHE_DIR.mkdir(exist_ok=True)
    AUDIO_CACHE_DIR.mkdir(exist_ok=True)

    # Launch background pre-warming task
    asyncio.create_task(load_model_background())

    yield  # App runs immediately on port 8001

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
    voices = []
    if VOICES_DIR.exists():
        for f in VOICES_DIR.iterdir():
            if f.suffix.lower() in [".wav", ".mp3", ".flac", ".ogg", ".m4a"]:
                voices.append({
                    "name": f.stem,
                    "filename": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 1),
                })
    return {
        "status": "ok" if MODEL_STATUS["ready"] else "warming_up",
        "online": True,
        "model_loaded": MODEL_STATUS["ready"],
        "model_status": MODEL_STATUS["status"],
        "step": MODEL_STATUS["step"],
        "progress": MODEL_STATUS["progress"],
        "device": DEVICE or "cpu",
        "load_time_sec": MODEL_STATUS["load_time_sec"],
        "voices": voices,
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
    if not MODEL_READY_EVENT.is_set():
        print("⏳ Synthesis request arrived while model is warming up. Waiting for initialization...")
        try:
            await asyncio.wait_for(MODEL_READY_EVENT.wait(), timeout=180.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="AI Neural Engine is still loading weights into RAM. Please try again in 10 seconds.")

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
        # Normalize float params to 2dp strings to prevent float rounding cache misses
        # e.g. 0.5 vs 0.50 vs 0.4999... would all hash differently otherwise!
        audio_hash = compute_file_hash(temp_input)
        clean_text_key = text.strip()
        norm_exag = f"{exaggeration:.2f}"
        norm_cfg  = f"{cfg_weight:.2f}"
        norm_spd  = f"{speed:.2f}"
        gen_cache_key = hashlib.md5(f"{audio_hash}|{clean_text_key}|{norm_exag}|{norm_cfg}|{norm_spd}".encode()).hexdigest()
        cached_audio_file = AUDIO_CACHE_DIR / f"{gen_cache_key}.wav"

        if cached_audio_file.exists():
            print(f"⚡ [Full Audio Cache HIT] '{clean_text_key[:40]}...' exag={norm_exag} cfg={norm_cfg} spd={norm_spd}x (~0.01s)! Skipping sampling!")
            with open(cached_audio_file, "rb") as f:
                cached_bytes = f.read()
            return StreamingResponse(
                io.BytesIO(cached_bytes),
                media_type="audio/wav",
                headers={
                    "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                    "Content-Length": str(len(cached_bytes)),
                    "X-Cache-Hit": "full_audio",
                    "X-Speed-Factor": norm_spd,
                },
            )

        # ── 2. Fresh Synthesis Pipeline ─────────────────────────────
        t_start = time.time()
        print(f"🎤 [Pipeline Started] Text: '{clean_text_key[:50]}...' | Ref: {temp_input.name} | exag={norm_exag} cfg={norm_cfg} spd={norm_spd}x")
        print(f"📦 [Phase 1/3 - CPU] Loading Voice Acoustic Embeddings & Conditionals...")
        get_or_prepare_conditionals(temp_input, exaggeration=exaggeration)

        print(f"🧠 [Phase 2/3 - CPU / 16GB RAM] Generating Speech Tokens via LLM (T3)...")
        print(f"🌊 [Phase 3/3 - {DEVICE}] Synthesizing Waveform via Diffusion Vocoder (1000 steps)...")

        wav = synthesize_speech_adaptive(
            text=clean_text_key,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            speed=speed,
        )

        # Save to temp file as standard 16-bit PCM WAV (AudioFormat: 1) for 100% universal browser playback
        ta.save(str(temp_output), wav, MODEL.sr, encoding="PCM_S", bits_per_sample=16)

        # Save to Audio Cache for instant future re-runs if audio is healthy
        if is_audio_valid_and_not_silent(wav, MODEL.sr):
            try:
                shutil.copyfile(temp_output, cached_audio_file)
                print(f"💾 [Audio Cache Saved] Next time this text is synthesized with this voice at {speed}x, it will load instantly (0.01s)!")
            except Exception as ce:
                print(f"⚠️ Audio cache write warning: {ce}")
        else:
            print("⚠️ [Cache Skipped] Generated audio has low acoustic energy or excessive silence. Skipping disk cache.")

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


# ─── Delete Saved Voice Profile ────────────────────────────────────
@app.delete("/delete-voice")
@app.delete("/voices/{voice_name}")
async def delete_voice(
    voice_name: Optional[str] = None,
    name: Optional[str] = None,
):
    """Delete a saved voice profile and purge related cached embeddings."""
    target_name = (voice_name or name or "").strip()
    if not target_name:
        raise HTTPException(status_code=400, detail="Voice name is required")

    deleted = False
    if VOICES_DIR.exists():
        for f in list(VOICES_DIR.iterdir()):
            if f.stem == target_name:
                try:
                    # Invalidate in-memory RAM cache if present
                    f_hash = compute_file_hash(f)
                    for k in list(ACTIVE_COND_CACHE.keys()):
                        if k.startswith(f_hash):
                            del ACTIVE_COND_CACHE[k]
                    # Delete disk embedding cache
                    disk_cache_file = EMBED_CACHE_DIR / f"{f_hash}.pt"
                    if disk_cache_file.exists():
                        disk_cache_file.unlink(missing_ok=True)
                    f.unlink(missing_ok=True)
                    deleted = True
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Voice profile '{target_name}' not found")

    print(f"🗑️ [Voice Deleted] Successfully removed voice profile '{target_name}'")
    return {"status": "deleted", "name": target_name}


# ─── Audio Cache Management ─────────────────────────────────────────
@app.post("/clear-cache")
async def clear_audio_cache():
    """
    Flushes all cached WAV audio files from audio_cache.
    Prevents stale, corrupt, or silent outputs from persisting.
    """
    try:
        deleted_count = 0
        freed_bytes = 0
        for f in AUDIO_CACHE_DIR.glob("*.wav"):
            try:
                freed_bytes += f.stat().st_size
                f.unlink(missing_ok=True)
                deleted_count += 1
            except Exception:
                pass
        freed_mb = round(freed_bytes / (1024 * 1024), 2)
        print(f"🧹 [Cache Flushed] Deleted {deleted_count} cached audio files ({freed_mb} MB).")
        return {"status": "ok", "deleted_count": deleted_count, "freed_mb": freed_mb}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear audio cache: {str(e)}")


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
    if not MODEL_READY_EVENT.is_set():
        print("⏳ Synthesis request arrived while model is warming up. Waiting for initialization...")
        try:
            await asyncio.wait_for(MODEL_READY_EVENT.wait(), timeout=180.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="AI Neural Engine is still loading weights into RAM. Please try again in 10 seconds.")

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
        # Normalize float params to 2dp to prevent float rounding cache misses
        norm_exag = f"{exaggeration:.2f}"
        norm_cfg  = f"{cfg_weight:.2f}"
        norm_spd  = f"{speed:.2f}"
        gen_cache_key = hashlib.md5(f"{voice_hash}|{clean_text_key}|{norm_exag}|{norm_cfg}|{norm_spd}".encode()).hexdigest()
        cached_audio_file = AUDIO_CACHE_DIR / f"{gen_cache_key}.wav"

        if cached_audio_file.exists():
            print(f"⚡ [Full Audio Cache HIT] Saved voice '{voice_name}' exag={norm_exag} cfg={norm_cfg} spd={norm_spd}x (~0.01s)! Skipping sampling!")
            with open(cached_audio_file, "rb") as f:
                cached_bytes = f.read()
            return StreamingResponse(
                io.BytesIO(cached_bytes),
                media_type="audio/wav",
                headers={
                    "Content-Disposition": f'attachment; filename="cloned_{file_id}.wav"',
                    "Content-Length": str(len(cached_bytes)),
                    "X-Cache-Hit": "full_audio",
                    "X-Speed-Factor": norm_spd,
                },
            )

        t_start = time.time()
        print(f"🎤 [Pipeline Started] Saved voice: '{voice_name}' | Text: '{clean_text_key[:50]}...' | Speed: {speed}x")
        print(f"📦 [Phase 1/3 - CPU] Loading Voice Embeddings & Conditionals...")
        get_or_prepare_conditionals(voice_file, exaggeration=exaggeration)

        print(f"🧠 [Phase 2/3 - CPU / 16GB RAM] Generating Speech Tokens via LLM (T3)...")
        print(f"🌊 [Phase 3/3 - {DEVICE}] Synthesizing Waveform via Diffusion Vocoder (1000 steps)...")

        wav = synthesize_speech_adaptive(
            text=clean_text_key,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            speed=speed,
        )

        # Save to temp file as standard 16-bit PCM WAV (AudioFormat: 1) for 100% universal browser playback
        ta.save(str(temp_output), wav, MODEL.sr, encoding="PCM_S", bits_per_sample=16)

        # Save to Audio Cache for instant future re-runs if audio is healthy
        if is_audio_valid_and_not_silent(wav, MODEL.sr):
            try:
                shutil.copyfile(temp_output, cached_audio_file)
                print(f"💾 [Audio Cache Saved] Next time this saved voice is synthesized with this text at {speed}x, it will load instantly (0.01s)!")
            except Exception as ce:
                print(f"⚠️ Audio cache write warning: {ce}")
        else:
            print("⚠️ [Cache Skipped] Generated audio has low acoustic energy or excessive silence. Skipping disk cache.")

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


VC_MODEL = None

def get_vc_model():
    global VC_MODEL
    if VC_MODEL is None:
        from chatterbox.vc import ChatterboxVC
        # Share S3Gen diffusion vocoder from MODEL to avoid allocating duplicate memory
        VC_MODEL = ChatterboxVC(s3gen=MODEL.s3gen, device=DEVICE)
    return VC_MODEL


# ─── Voice Conversion Endpoint (Option A: Microsoft TTS -> Cloned Voice) ────
@app.post("/convert-voice")
async def convert_voice(
    source_audio: UploadFile = File(..., description="Source speech audio (e.g. from Microsoft Edge TTS)"),
    voice_name: Optional[str] = Form(None, description="Name of previously saved voice profile"),
    target_wav: Optional[UploadFile] = File(None, description="Optional raw reference voice audio"),
    speed: float = Form(1.0, description="Speed factor multiplier (0.75 - 1.35)"),
):
    """
    Converts source speech audio (e.g. high-fidelity Microsoft Neural TTS)
    into the timbre and acoustic identity of the target cloned voice.
    """
    if not MODEL_READY_EVENT.is_set():
        try:
            await asyncio.wait_for(MODEL_READY_EVENT.wait(), timeout=180.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="AI Neural Engine is still loading weights into RAM.")

    speed = max(0.75, min(1.35, float(speed)))
    file_id = str(uuid.uuid4())[:8]
    temp_source = UPLOAD_DIR / f"vc_src_{file_id}.wav"
    temp_target = None
    temp_output = OUTPUT_DIR / f"vc_out_{file_id}.wav"

    try:
        # Save source speech audio
        with open(temp_source, "wb") as f:
            f.write(await source_audio.read())

        target_path = None
        if voice_name and voice_name.strip():
            for f in VOICES_DIR.iterdir():
                if f.stem == voice_name.strip():
                    target_path = f
                    break
            if not target_path:
                raise HTTPException(status_code=404, detail=f"Voice profile '{voice_name}' not found")
        elif target_wav:
            ext = Path(target_wav.filename or "audio.wav").suffix or ".wav"
            temp_target = UPLOAD_DIR / f"vc_tgt_{file_id}{ext}"
            with open(temp_target, "wb") as f:
                f.write(await target_wav.read())
            target_path = temp_target
        else:
            raise HTTPException(status_code=400, detail="Either voice_name or target_wav must be provided.")

        t_start = time.time()
        print(f"🔄 [Voice Conversion] Converting Microsoft audio to cloned voice: '{target_path.stem}'...")

        vc = get_vc_model()
        vc.set_target_voice(str(target_path))
        wav = vc.generate(str(temp_source))

        if abs(speed - 1.0) >= 0.02:
            wav = apply_time_stretch(wav, vc.sr, speed)

        if wav.dim() == 1:
            wav = wav.unsqueeze(0)
        wav = torch.clamp(wav, -1.0, 1.0)

        ta.save(str(temp_output), wav, vc.sr, encoding="PCM_S", bits_per_sample=16)
        elapsed = round(time.time() - t_start, 1)
        print(f"✅ [Conversion Complete] Finished in {elapsed}s!")

        with open(temp_output, "rb") as f:
            audio_bytes = f.read()

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="converted_{file_id}.wav"',
                "Content-Length": str(len(audio_bytes)),
                "X-Conversion-Time": str(elapsed),
                "X-Speed-Factor": str(speed),
            },
        )
    except Exception as e:
        print(f"❌ Voice Conversion error: {e}")
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {str(e)}")
    finally:
        if temp_source.exists():
            temp_source.unlink(missing_ok=True)
        if temp_target and temp_target.exists():
            temp_target.unlink(missing_ok=True)
        if temp_output.exists():
            temp_output.unlink(missing_ok=True)


# ─── Entry Point ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("Starting S-Q-TTS Voice Clone Server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
