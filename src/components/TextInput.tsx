"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Trash2,
  AlignLeft,
  AlignRight,
  Wand2,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  VolumeX,
} from "lucide-react";
import { SAMPLE_PRESETS, Preset } from "@/lib/presets";
import { parseScriptTags } from "@/lib/script-parser";

interface TextInputProps {
  text: string;
  onChange: (value: string) => void;
  onSelectPreset: (preset: Preset) => void;
  autoCleanTags: boolean;
  onToggleAutoClean: (val: boolean) => void;
  disabled?: boolean;
}

export function TextInput({
  text,
  onChange,
  onSelectPreset,
  autoCleanTags,
  onToggleAutoClean,
  disabled = false,
}: TextInputProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Simple heuristic for RTL scripts (Urdu, Arabic, Hebrew, Farsi)
  const isRTL = useMemo(() => {
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return rtlRegex.test(text.slice(0, 50));
  }, [text]);

  const charCount = text.length;
  const maxChars = 5000;

  // Real-time analysis of script directions & pause tags
  const scriptAnalysis = useMemo(() => {
    return parseScriptTags(text);
  }, [text]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>Enter Script</span>
          <span className="text-xs font-normal text-slate-400">
            (Supports [Pause], [Emotion], [Tone] script tags)
          </span>
        </label>
        <div className="flex items-center gap-3 text-xs">
          {text.length > 0 && (
            <button
              onClick={() => onChange("")}
              disabled={disabled}
              className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
              title="Clear text"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
          <span
            className={`${
              charCount > maxChars ? "text-rose-400 font-bold" : "text-slate-400"
            }`}
          >
            {charCount.toLocaleString()} / {maxChars.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main Textarea Container */}
      <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 shadow-inner focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
        {showPreview ? (
          <div className="px-4 py-3 min-h-[144px] bg-slate-950/60 rounded-t-2xl font-normal leading-relaxed text-slate-200 text-sm whitespace-pre-wrap border-b border-white/5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs text-brand-300">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Cleaned Script Preview (What will actually be spoken):</span>
              </span>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-white"
              >
                Return to Editor ✕
              </button>
            </div>
            <p className="italic text-slate-300">
              {scriptAnalysis.cleanedText || "(Empty text)"}
            </p>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            dir={isRTL ? "rtl" : "ltr"}
            placeholder="Type or paste your script here... (e.g. [Soft and reflective] Sometimes, you are not sleepy. [Short pause] You are just carrying things...)"
            rows={6}
            className={`w-full bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-normal leading-relaxed ${
              isRTL ? "text-right font-serif text-lg" : "text-left text-sm"
            }`}
          />
        )}

        <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 bg-slate-950/30 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {isRTL ? (
              <span className="flex items-center gap-1 text-brand-400">
                <AlignRight className="h-3.5 w-3.5" />
                <span>RTL (Urdu/Arabic)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlignLeft className="h-3.5 w-3.5" />
                <span>LTR</span>
              </span>
            )}
          </div>

          {/* Toggle for Preview Cleaned Text */}
          {scriptAnalysis.hasTags && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Show Raw Script</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview Cleaned Audio Script</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Smart Script Tag Manager (Beta) Banner when tags are detected */}
      {scriptAnalysis.hasTags && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/60 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                Beta Engine
              </span>
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                <Wand2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Smart Script Tag Manager</span>
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={autoCleanTags}
                onChange={(e) => onToggleAutoClean(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Auto-Manage Tags (Recommended)</span>
            </label>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Detected <strong className="text-indigo-300">{scriptAnalysis.detectedTags.length}</strong> bracket directions.
            Stage emotions are muted so they aren't awkwardly spoken, and pause tags are naturalized into audio silences.
          </p>

          {/* Detected tags chips */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {scriptAnalysis.detectedTags.map((tag, idx) => (
              <span
                key={idx}
                className={`text-[10px] px-2 py-0.5 rounded-lg border flex items-center gap-1 font-mono ${
                  tag.type === "pause"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                }`}
              >
                {tag.type === "pause" ? (
                  <Clock className="h-2.5 w-2.5 text-emerald-400" />
                ) : (
                  <VolumeX className="h-2.5 w-2.5 text-indigo-400" />
                )}
                <span>{tag.raw}</span>
                <span className="opacity-70">
                  {tag.type === "pause"
                    ? `(${((tag.pauseDurationMs || 1000) / 1000).toFixed(1)}s pause)`
                    : "(muted)"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Script Ideas pills */}
      <div className="space-y-1.5">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>💡 Quick Script Samples:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              disabled={disabled}
              className="text-xs bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
