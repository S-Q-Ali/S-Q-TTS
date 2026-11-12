"use client";

import React, { useRef, useState, useEffect } from "react";
import { Play, Pause, Download, RotateCcw, Volume2, Sparkles } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string | null;
  textSnippet?: string;
  voiceLabel?: string;
  autoPlay?: boolean;
}

export function AudioPlayer({
  audioUrl,
  textSnippet,
  voiceLabel,
  autoPlay = true,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      if (autoPlay) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => console.log("Autoplay was prevented:", err));
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
      audioRef.current.play();
      setIsPlaying(true);
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

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-4 sm:p-5 shadow-2xl shadow-brand-500/10 space-y-3 ring-1 ring-brand-500/20">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Audio Generated
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
            download={`SQ_TTS_${voiceLabel || "speech"}_${Date.now()}.mp3`}
            className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-500 text-white font-medium px-3.5 py-1.5 rounded-lg shadow-md shadow-brand-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download MP3</span>
          </a>
        </div>
      </div>

      {/* Play Controls & Seek Bar */}
      <div className="flex items-center gap-3 sm:gap-4 pt-1">
        <button
          onClick={togglePlay}
          className="h-12 w-12 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 transition-all hover:scale-105 active:scale-95 shrink-0"
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
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
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
