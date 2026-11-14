"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { parseScriptTags } from "@/lib/script-parser";
import {
  Upload,
  Mic,
  Square,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Server,
  Sliders,
  AudioWaveform,
  Volume2,
  Download,
  Loader2,
  HelpCircle,
  Wand2,
  Eye,
  EyeOff,
  Clock,
  VolumeX,
  BookmarkPlus,
  Save,
  Cpu,
  Layers,
  Zap,
  Activity,
} from "lucide-react";

export function VoiceCloneStudio() {
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [device, setDevice] = useState<string>("cpu");
  const [savedVoices, setSavedVoices] = useState<Array<{ name: string; filename: string; size_kb: number }>>([]);
  const [checkingServer, setCheckingServer] = useState<boolean>(true);

  // Form State
  const [text, setText] = useState<string>(
    "Hello! This is a realistic preview of my cloned voice, synthesized completely free and locally."
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [selectedSavedVoice, setSelectedSavedVoice] = useState<string>("");
  const [exaggeration, setExaggeration] = useState<number>(0.5);
  const [cfgWeight, setCfgWeight] = useState<number>(0.5);
  const [autoCleanTags, setAutoCleanTags] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Voice Profile Saving State
  const [newVoiceName, setNewVoiceName] = useState<string>("");
  const [isSavingVoice, setIsSavingVoice] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Script tags analysis
  const scriptAnalysis = useMemo(() => {
    return parseScriptTags(text);
  }, [text]);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesis State & Live Telemetry
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisElapsed, setSynthesisElapsed] = useState<number>(0);
  const synthesisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check server health
  const checkHealth = async () => {
    try {
      setCheckingServer(true);
      const res = await fetch("/api/clone", { cache: "no-store" });
      const data = await res.json();
      if (data.online) {
        setServerOnline(true);
        setDevice(data.device || "cpu");
        setSavedVoices(data.voices || []);
        setError(null);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setCheckingServer(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      setSelectedSavedVoice("");
      setSaveSuccessMsg(null);
      const url = URL.createObjectURL(file);
      setAudioPreviewUrl(url);
    }
  };

  // Start live recording
  const startRecording = async () => {
    try {
      setError(null);
      setSaveSuccessMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const file = new File([audioBlob], `recorded_sample_${Date.now()}.wav`, { type: "audio/wav" });
        setAudioFile(file);
        setSelectedSavedVoice("");
        const url = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError("Microphone permission denied or not available: " + err.message);
    }
  };

  // Stop live recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Save Voice Profile to Server
  const handleSaveVoiceProfile = async () => {
    if (!newVoiceName.trim()) {
      setError("Please provide a name for this voice profile.");
      return;
    }
    if (!audioFile) {
      setError("Please upload or record an audio sample first to save it.");
      return;
    }

    try {
      setIsSavingVoice(true);
      setError(null);
      setSaveSuccessMsg(null);

      const saveFd = new FormData();
      saveFd.append("name", newVoiceName.trim());
      saveFd.append("speaker_wav", audioFile);

      const res = await fetch("/api/clone/save", {
        method: "POST",
        body: saveFd,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save voice profile");
      }

      const result = await res.json();
      setSaveSuccessMsg(`Voice profile "${result.name}" saved permanently!`);
      setNewVoiceName("");
      await checkHealth();
      setSelectedSavedVoice(result.name);
    } catch (err: any) {
      setError(err.message || "Could not save voice profile");
    } finally {
      setIsSavingVoice(false);
    }
  };

  // Run Voice Cloning
  const handleCloneAndGenerate = async () => {
    if (!text.trim()) {
      setError("Please write some text to synthesize.");
      return;
    }

    if (!audioFile && !selectedSavedVoice) {
      setError("Please upload an audio sample, record your voice (6-15s), or pick a saved voice.");
      return;
    }

    try {
      setIsSynthesizing(true);
      setSynthesisElapsed(0);
      setError(null);
      setSuccessMsg(null);

      synthesisTimerRef.current = setInterval(() => {
        setSynthesisElapsed((prev) => prev + 1);
      }, 1000);

      const formData = new FormData();
      formData.append("text", text.trim());
      formData.append("exaggeration", exaggeration.toString());
      formData.append("cfg_weight", cfgWeight.toString());
      formData.append("auto_clean", autoCleanTags ? "true" : "false");

      if (audioFile) {
        formData.append("speaker_wav", audioFile);
      } else if (selectedSavedVoice) {
        formData.append("voice_name", selectedSavedVoice);
      }

      const res = await fetch("/api/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to clone voice (${res.status})`);
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      setGeneratedAudioUrl(audioUrl);
      setSuccessMsg("Voice cloned and synthesized successfully!");
    } catch (err: any) {
      setError(err.message || "Synthesis error");
    } finally {
      if (synthesisTimerRef.current) {
        clearInterval(synthesisTimerRef.current);
        synthesisTimerRef.current = null;
      }
      setIsSynthesizing(false);
    }
  };

  // Helper formatting for seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Compute active phase and estimated percentage
  // Phase 1 (0-10s): Embeddings
  // Phase 2 (10-45s): T3 LLM tokens (CPU)
  // Phase 3 (45s+): Diffusion Vocoder (1000 steps)
  const currentPhase = synthesisElapsed < 10 ? 1 : synthesisElapsed < 50 ? 2 : 3;
  const estimatedProgress = Math.min(95, Math.max(5, Math.round((synthesisElapsed / 160) * 100)));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Server Status Header Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm transition-colors ${
          serverOnline
            ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
            : "bg-amber-950/30 border-amber-800/40 text-amber-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              serverOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" />
              {serverOnline
                ? `Local Voice Engine Active (Device: ${device.toUpperCase()})`
                : "Voice Clone Server (Port 8001) Disconnected"}
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {serverOnline
                ? "Chatterbox zero-shot voice cloning engine is online & ready (RAM & Audio Cache active)."
                : "Run 'voice-clone-server/start.bat' on your PC to enable local AI voice cloning."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {serverOnline && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-800/90 text-purple-300 border border-purple-500/30">
              <Cpu className="w-3 h-3 text-purple-400" />
              CPU / 16GB RAM
            </span>
          )}
          <button
            onClick={checkHealth}
            disabled={checkingServer}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-xs text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${checkingServer ? "animate-spin" : ""}`} />
            Check Server
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Voice Sample Input (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <AudioWaveform className="w-4 h-4 text-purple-400" />
                1. Voice Reference Sample
              </label>
              <span className="text-xs text-purple-400 font-medium">6 - 15 sec sample</span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload a clear voice recording or record live using your microphone.
            </p>

            {/* Upload Area */}
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-purple-500/80 bg-zinc-950/60 hover:bg-purple-950/10 rounded-xl p-5 text-center cursor-pointer transition group">
                <input
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/m4a,audio/ogg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="w-6 h-6 text-purple-400" />
                <div className="text-xs">
                  {audioFile ? (
                    <span className="font-semibold text-purple-300">{audioFile.name}</span>
                  ) : (
                    <>
                      <span className="text-zinc-200 font-medium">Click to upload voice audio</span>
                      <p className="text-[11px] text-zinc-500 mt-0.5">MP3, WAV, M4A up to 25MB</p>
                    </>
                  )}
                </div>
              </label>

              {/* Live Record Button */}
              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-red-400" />
                    Record with Microphone
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    Stop Recording ({recordingSeconds}s)
                  </button>
                )}
              </div>

              {/* Audio preview of uploaded/recorded sample */}
              {audioPreviewUrl && (
                <div className="bg-zinc-800/60 rounded-xl p-3 border border-zinc-700/60 space-y-1.5">
                  <span className="text-[11px] text-zinc-400 block font-medium">Sample Preview:</span>
                  <audio controls src={audioPreviewUrl} className="w-full h-8" />
                </div>
              )}

              {/* Feature 1: Save Voice Profile Card */}
              {audioFile && (
                <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <BookmarkPlus className="w-3.5 h-3.5 text-purple-400" />
                      Save this Voice as Preset Profile
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVoiceName}
                      onChange={(e) => setNewVoiceName(e.target.value)}
                      placeholder="Profile Name (e.g., My English Voice)"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      disabled={isSavingVoice || !newVoiceName.trim()}
                      onClick={handleSaveVoiceProfile}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      {isSavingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Profile
                    </button>
                  </div>
                  {saveSuccessMsg && (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {saveSuccessMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Saved Voices Dropdown (if any exist) */}
              {savedVoices.length > 0 && (
                <div className="pt-2 border-t border-zinc-800">
                  <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
                    Or pick from saved voice profiles:
                  </label>
                  <select
                    value={selectedSavedVoice}
                    onChange={(e) => {
                      setSelectedSavedVoice(e.target.value);
                      setAudioFile(null);
                      setAudioPreviewUrl(null);
                      setSaveSuccessMsg(null);
                    }}
                    className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">-- Select Saved Profile --</option>
                    {savedVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.size_kb} KB)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Voice Tuning Parameters */}
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Acoustic Dynamics
              </span>

              {/* Exaggeration Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Expressiveness / Exaggeration</span>
                  <span className="text-purple-400 font-mono">{exaggeration}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={exaggeration}
                  onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* CFG Guidance Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Voice Similarity Weight (CFG)</span>
                  <span className="text-purple-400 font-mono">{cfgWeight}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={cfgWeight}
                  onChange={(e) => setCfgWeight(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Script Input & Synthesis Output (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                2. Speech Script
              </label>
              <div className="flex items-center gap-2">
                {scriptAnalysis.hasTags && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Show Raw</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Cleaned</span>
                      </>
                    )}
                  </button>
                )}
                <span className="text-xs text-zinc-500">{text.length} chars</span>
              </div>
            </div>

            {showPreview ? (
              <div className="w-full bg-zinc-950/90 border border-purple-500/30 rounded-xl p-4 text-sm text-zinc-200 min-h-[148px] space-y-2">
                <div className="flex items-center justify-between text-xs text-purple-300 border-b border-zinc-800 pb-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Cleaned Voice Output (Tags auto-muted, natural pauses preserved):
                  </span>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs"
                  >
                    Back to Raw ✕
                  </button>
                </div>
                <p className="italic text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {scriptAnalysis.cleanedText || "(Empty text)"}
                </p>
              </div>
            ) : (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y font-sans leading-relaxed"
                placeholder="What do you want your cloned voice to say? Write your script here... Supports [Softly], [Short pause], [Gentle sadness], etc."
              />
            )}

            {/* Smart Script Tag Manager (Beta) Banner for Cloning */}
            {scriptAnalysis.hasTags && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/30 p-3.5 space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="font-semibold text-purple-200">
                      Smart Script Tag Manager (Beta)
                    </span>
                    <span className="bg-purple-500/20 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30">
                      {scriptAnalysis.detectedTags.length} detected
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCleanTags}
                      onChange={(e) => setAutoCleanTags(e.target.checked)}
                      className="accent-purple-500 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className="text-[11px] text-zinc-300 font-medium">Auto-Mute Tags</span>
                  </label>
                </div>

                {/* Detected Tag Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {scriptAnalysis.detectedTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                        tag.action === "pause"
                          ? "bg-amber-950/40 text-amber-300 border-amber-800/50"
                          : "bg-purple-950/50 text-purple-300 border-purple-800/50"
                      }`}
                    >
                      {tag.action === "pause" ? (
                        <Clock className="w-3 h-3 text-amber-400" />
                      ) : (
                        <VolumeX className="w-3 h-3 text-purple-400" />
                      )}
                      <span>{tag.raw}</span>
                      <span className="opacity-75 text-[10px]">
                        {tag.action === "pause"
                          ? `(${((tag.pauseDurationMs || 1000) / 1000).toFixed(1)}s pause)`
                          : "(muted)"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Error & Success Messages */}
            {error && (
              <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Features 3 & 4: Live Progress Bar & Hardware Activity Telemetry */}
            {isSynthesizing && (
              <div className="bg-zinc-950/95 border border-purple-500/40 rounded-xl p-4 space-y-3.5 animate-in fade-in shadow-xl shadow-purple-950/30">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-purple-200">
                    <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span>Neural Synthesis in Progress...</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-purple-400" />
                    <span>Elapsed: {formatTime(synthesisElapsed)}</span>
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden border border-zinc-700/60">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-400 h-2.5 rounded-full transition-all duration-1000 relative"
                      style={{ width: `${estimatedProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Progress: ~{estimatedProgress}%</span>
                    <span>Expected Total: ~02:40 (CPU Mode)</span>
                  </div>
                </div>

                {/* 3-Phase Execution Telemetry */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-800/80">
                  {/* Phase 1 */}
                  <div
                    className={`p-2 rounded-lg border text-[10px] space-y-1 transition-all ${
                      currentPhase === 1
                        ? "bg-purple-950/60 border-purple-500/80 text-purple-200 shadow-sm"
                        : currentPhase > 1
                        ? "bg-zinc-900/40 border-emerald-800/40 text-emerald-300"
                        : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>Phase 1</span>
                      {currentPhase > 1 ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <span className="text-[9px] px-1 bg-purple-500/20 text-purple-300 rounded font-mono">CPU</span>
                      )}
                    </div>
                    <div className="font-semibold truncate">Embeddings</div>
                    <div className="opacity-70 text-[9px]">RAM/Disk Cache</div>
                  </div>

                  {/* Phase 2 */}
                  <div
                    className={`p-2 rounded-lg border text-[10px] space-y-1 transition-all ${
                      currentPhase === 2
                        ? "bg-purple-950/60 border-purple-500/80 text-purple-200 shadow-sm"
                        : currentPhase > 2
                        ? "bg-zinc-900/40 border-emerald-800/40 text-emerald-300"
                        : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>Phase 2</span>
                      {currentPhase > 2 ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : currentPhase === 2 ? (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      ) : (
                        <span className="text-[9px] px-1 bg-zinc-800 rounded font-mono">CPU</span>
                      )}
                    </div>
                    <div className="font-semibold truncate">T3 LLM Tokens</div>
                    <div className="opacity-70 text-[9px]">16 GB System RAM</div>
                  </div>

                  {/* Phase 3 */}
                  <div
                    className={`p-2 rounded-lg border text-[10px] space-y-1 transition-all ${
                      currentPhase === 3
                        ? "bg-purple-950/60 border-purple-500/80 text-purple-200 shadow-sm"
                        : "bg-zinc-900/30 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>Phase 3</span>
                      {currentPhase === 3 ? (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      ) : (
                        <span className="text-[9px] px-1 bg-zinc-800 rounded font-mono">DIFFUSION</span>
                      )}
                    </div>
                    <div className="font-semibold truncate">1000 Sampling</div>
                    <div className="opacity-70 text-[9px]">{device.toUpperCase()} Vocoder</div>
                  </div>
                </div>
              </div>
            )}

            {/* Clone Button */}
            <button
              onClick={handleCloneAndGenerate}
              disabled={isSynthesizing || serverOnline === false}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 transition cursor-pointer"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synthesizing Cloned Voice ({formatTime(synthesisElapsed)})...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Clone Voice & Generate Speech
                </>
              )}
            </button>

            {/* Generated Audio Result Box */}
            {generatedAudioUrl && (
              <div className="p-4 bg-zinc-950/90 border border-purple-500/40 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    Generated Cloned Audio:
                  </span>
                  <a
                    href={generatedAudioUrl}
                    download="cloned_speech.wav"
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download WAV
                  </a>
                </div>
                <audio controls autoPlay src={generatedAudioUrl} className="w-full h-10" />
              </div>
            )}
          </div>

          {/* Educational Quick Guide Box */}
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
            <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              Tips for Best Voice Cloning Results:
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-zinc-400/90">
              <li>Use a <strong>6 to 15-second</strong> audio sample of continuous, clear speech.</li>
              <li>Avoid samples with loud background noise, music, or heavy echo.</li>
              <li><strong>Audio Cache:</strong> Re-synthesizing previously generated text is <strong>instant (0.01s)</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
