"use client";

import React from "react";
import { Sliders, RotateCcw, FastForward, Activity, Volume2 } from "lucide-react";

interface VoiceControlsProps {
  rate: number; // percentage offset: -50 to +100 (0 = normal 1.0x)
  pitch: number; // Hz offset: -50 to +50 (0 = normal)
  volume: number; // percentage: -50 to +50 (0 = normal 100%)
  onRateChange: (val: number) => void;
  onPitchChange: (val: number) => void;
  onVolumeChange: (val: number) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function VoiceControls({
  rate,
  pitch,
  volume,
  onRateChange,
  onPitchChange,
  onVolumeChange,
  onReset,
  disabled = false,
}: VoiceControlsProps) {
  // Convert rate percentage to human-friendly speed multiplier (e.g. +0% = 1.0x, +50% = 1.5x)
  const speedMultiplier = ((100 + rate) / 100).toFixed(2);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Sliders className="h-4 w-4 text-brand-400" />
          <span>Speech Tuning & Prosody</span>
        </div>
        <button
          onClick={onReset}
          disabled={disabled || (rate === 0 && pitch === 0 && volume === 0)}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rate / Speed Slider */}
        <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 flex items-center gap-1.5">
              <FastForward className="h-3.5 w-3.5 text-blue-400" />
              <span>Speed (Rate)</span>
            </span>
            <span className="font-mono text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded text-[11px]">
              {speedMultiplier}x ({rate >= 0 ? `+${rate}%` : `${rate}%`})
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={100}
            step={5}
            value={rate}
            onChange={(e) => onRateChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0.5x</span>
            <span>1.0x (Normal)</span>
            <span>2.0x</span>
          </div>
        </div>

        {/* Pitch Slider */}
        <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              <span>Pitch</span>
            </span>
            <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">
              {pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`}
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={5}
            value={pitch}
            onChange={(e) => onPitchChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Deeper (-50Hz)</span>
            <span>0Hz</span>
            <span>Higher (+50Hz)</span>
          </div>
        </div>

        {/* Volume Slider */}
        <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Volume</span>
            </span>
            <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
              {volume >= 0 ? `+${volume}%` : `${volume}%`}
            </span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={5}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Softer (-50%)</span>
            <span>Default</span>
            <span>Louder (+50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
