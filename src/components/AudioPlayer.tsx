"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Download, RotateCcw, Volume2, Sparkles } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string | null;
  textSnippet?: string;
  voiceLabel?: string;
  autoPlay?: boolean;
  variant?: "brand" | "purple";
  format?: "mp3" | "wav";
}

export function AudioPlayer({
  audioUrl,
  textSnippet,
  voiceLabel,
  autoPlay = true,
  variant = "brand",
  format = "mp3",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    setPlaybackError(null);
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      if (autoPlay) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            // Autoplay policy prevented playback; user must click play
            console.log("Autoplay was prevented by browser policy:", err);
            setIsPlaying(false);
          });
      }
    }
  }, [audioUrl, autoPlay]);

  if (!audioUrl) {
    return null;
  }

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setPlaybackError(null);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Audio playback error:", err);
          setPlaybackError("Playback could not start. Please click Play again.");
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const mins = Math.floor(secs / 60);
    const remaining = Math.floor(secs % 60);
    return `${mins}:${remaining < 10 ? "0" : ""}${remaining}`;
  };

  const isPurple = variant === "purple";
  const ext = format.toLowerCase();
  const downloadFileName = `SQ_TTS_${(voiceLabel || "speech").replace(/\s+/g, "_")}_${Date.now()}.${ext}`;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-3 ring-1 transition-all ${
        isPurple
          ? "border-purple-500/30 bg-gradient-to-b from-zinc-950/95 via-purple-950/20 to-zinc-950/95 ring-purple-500/20 shadow-purple-950/30"
          : "border-brand-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/95 ring-brand-500/20 shadow-brand-500/10"
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setPlaybackError("Audio playback error. Please verify the audio file.")}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {isPurple ? "Neural Voice Cloned" : "Audio Generated"}
            </span>
            {voiceLabel && (
              <span className="text-xs text-slate-400">• Voice: {voiceLabel}</span>
            )}
          </div>
          {textSnippet && (
            <p className="text-xs text-slate-300 mt-1 line-clamp-1 italic max-w-xl">
              "{textSnippet}"
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={cycleSpeed}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-white/10 font-mono transition-colors"
            title="Change Playback Speed"
          >
            {playbackSpeed}x
          </button>
          <a
            href={audioUrl}
            download={downloadFileName}
            className={`flex items-center gap-1.5 text-xs text-white font-medium px-3.5 py-1.5 rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 ${
              isPurple
                ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                : "bg-brand-600 hover:bg-brand-500 shadow-brand-600/30"
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download {ext.toUpperCase()}</span>
          </a>
        </div>
      </div>

      {playbackError && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg p-2">
          {playbackError}
        </div>
      )}

      {/* Play Controls & Seek Bar */}
      <div className="flex items-center gap-3 sm:gap-4 pt-1">
        <button
          onClick={togglePlay}
          className={`h-12 w-12 rounded-xl text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0 ${
            isPurple
              ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
              : "bg-brand-600 hover:bg-brand-500 shadow-brand-600/30"
          }`}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              isPurple
                ? "bg-zinc-800 accent-purple-500"
                : "bg-slate-800 accent-brand-500"
            }`}
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
