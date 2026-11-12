"use client";

import React, { useMemo } from "react";
import { Sparkles, Trash2, AlignLeft, AlignRight } from "lucide-react";
import { SAMPLE_PRESETS, Preset } from "@/lib/presets";

interface TextInputProps {
  text: string;
  onChange: (value: string) => void;
  onSelectPreset: (preset: Preset) => void;
  disabled?: boolean;
}

export function TextInput({
  text,
  onChange,
  onSelectPreset,
  disabled = false,
}: TextInputProps) {
  // Simple heuristic for RTL scripts (Urdu, Arabic, Hebrew, Farsi)
  const isRTL = useMemo(() => {
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return rtlRegex.test(text.slice(0, 50));
  }, [text]);

  const charCount = text.length;
  const maxChars = 5000;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>Enter Text</span>
          <span className="text-xs font-normal text-slate-400">
            (Supports English, Urdu, Arabic, Hindi, Spanish, and 70+ languages)
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

      <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 shadow-inner focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          dir={isRTL ? "rtl" : "ltr"}
          placeholder="Type or paste your text here to convert into natural speech..."
          rows={6}
          className={`w-full bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-normal leading-relaxed ${
            isRTL ? "text-right font-serif text-lg" : "text-left text-sm"
          }`}
        />
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
          <span>Natural Neural Speech Mode</span>
        </div>
      </div>

      {/* Script Ideas pills */}
      <div className="space-y-1.5">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" />
          <span>💡 Sample Script Ideas (Click to load text):</span>
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
