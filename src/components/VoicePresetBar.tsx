"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles,
  BookmarkPlus,
  Trash2,
  Download,
  Upload,
  Check,
  SlidersHorizontal,
  Info,
  X,
  PlusCircle,
} from "lucide-react";
import {
  VoicePreset,
  PresetCategory,
  BUILT_IN_VOICE_PRESETS,
  getStoredCustomPresets,
  saveCustomPresetToStorage,
  deleteCustomPresetFromStorage,
  exportPresetsAsJSON,
  importPresetsFromJSON,
} from "@/lib/voice-presets";

interface VoicePresetBarProps {
  currentVoice: string;
  currentRate: number;
  currentPitch: number;
  currentVolume: number;
  onApplyPreset: (preset: VoicePreset) => void;
  disabled?: boolean;
}

export function VoicePresetBar({
  currentVoice,
  currentRate,
  currentPitch,
  currentVolume,
  onApplyPreset,
  disabled = false,
}: VoicePresetBarProps) {
  const [customPresets, setCustomPresets] = useState<VoicePreset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetCategory, setPresetCategory] = useState<PresetCategory>("Custom");
  const [presetDescription, setPresetDescription] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load custom presets on client mount
  useEffect(() => {
    setCustomPresets(getStoredCustomPresets());
  }, []);

  const allPresets = useMemo(() => {
    return [...customPresets, ...BUILT_IN_VOICE_PRESETS];
  }, [customPresets]);

  const categories = useMemo(() => {
    return [
      { id: "ALL", label: "All Presets" },
      { id: "Motivational", label: "🔥 Motivational" },
      { id: "Storytelling", label: "🎬 Story & Narration" },
      { id: "Content Creation", label: "⚡ Video & Podcast" },
      { id: "Broadcast & News", label: "📰 News & Media" },
      { id: "Literature & Poetry", label: "📜 Urdu Literature" },
      { id: "Meditation", label: "🌙 Meditation" },
      { id: "Custom", label: `⭐ My Custom (${customPresets.length})` },
    ];
  }, [customPresets.length]);

  const filteredPresets = useMemo(() => {
    if (selectedCategory === "ALL") return allPresets;
    if (selectedCategory === "Custom") return customPresets;
    return allPresets.filter((p) => p.category === selectedCategory);
  }, [allPresets, customPresets, selectedCategory]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApply = (preset: VoicePreset) => {
    onApplyPreset(preset);
    triggerToast(`Applied Preset: "${preset.name}" (${preset.voice})`);
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    const saved = saveCustomPresetToStorage({
      name: presetName.trim(),
      category: presetCategory,
      icon: "⭐",
      voice: currentVoice,
      rate: currentRate,
      pitch: currentPitch,
      volume: currentVolume,
      description:
        presetDescription.trim() ||
        `Custom profile based on ${currentVoice} (${currentRate >= 0 ? `+${currentRate}%` : `${currentRate}%`} speed, ${currentPitch >= 0 ? `+${currentPitch}Hz` : `${currentPitch}Hz`} pitch)`,
    });

    setCustomPresets((prev) => [saved, ...prev]);
    setIsModalOpen(false);
    setPresetName("");
    setPresetDescription("");
    triggerToast(`Custom preset "${saved.name}" saved successfully!`);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomPresetFromStorage(id);
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    triggerToast("Custom preset deleted.");
  };

  const handleExport = () => {
    exportPresetsAsJSON(allPresets);
    triggerToast("Exported all presets as JSON.");
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const updated = importPresetsFromJSON(text);
        setCustomPresets(updated);
        triggerToast("Presets imported successfully!");
      } catch (err: any) {
        alert("Failed to import presets: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="glass-panel p-5 rounded-3xl space-y-4 border border-brand-500/20 bg-slate-900/70 shadow-lg">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".json"
        className="hidden"
      />

      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center border border-brand-500/30">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Voice Profiles & Sound Presets</span>
              <span className="text-[10px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">
                Independent of Text
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              One-click vocal tuning (Voice + Pitch + Speed) for any script
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs bg-brand-600/90 hover:bg-brand-600 text-white font-medium px-3 py-1.5 rounded-xl shadow-md shadow-brand-600/20 border border-brand-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Save your current voice slider tuning as a reusable preset"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>Save Current as Preset</span>
          </button>

          <button
            onClick={handleExport}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-white/10 transition-colors"
            title="Export Presets to JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-white/10 transition-colors"
            title="Import Presets from JSON"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="py-1.5 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              selectedCategory === cat.id
                ? "bg-brand-600 text-white border-brand-500 font-medium shadow-sm"
                : "bg-slate-950/40 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
        {filteredPresets.map((preset) => {
          const isActive =
            currentVoice === preset.voice &&
            currentRate === preset.rate &&
            currentPitch === preset.pitch;

          const speedDisplay = ((100 + preset.rate) / 100).toFixed(2);

          return (
            <div
              key={preset.id}
              onClick={() => handleApply(preset)}
              className={`group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-200 ${
                isActive
                  ? "bg-brand-600/15 border-brand-500 shadow-md ring-1 ring-brand-500/40"
                  : "bg-slate-950/40 border-white/5 hover:border-white/15 hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{preset.icon}</span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-brand-300 transition-colors">
                      {preset.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {preset.category}
                    </span>
                  </div>
                </div>

                {!preset.isBuiltIn && (
                  <button
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                    title="Delete Preset"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}

                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 shrink-0" />
                )}
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                {preset.description}
              </p>

              {/* Specs Badge Bar */}
              <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-white/5 text-slate-400">
                <span className="truncate max-w-[110px] font-sans font-medium text-slate-300">
                  {preset.voice.replace("Neural", "")}
                </span>
                <span className="bg-slate-800/80 px-1.5 py-0.5 rounded text-brand-300 shrink-0">
                  {speedDisplay}x • {preset.pitch >= 0 ? `+${preset.pitch}Hz` : `${preset.pitch}Hz`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Custom Preset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookmarkPlus className="h-4 w-4 text-brand-400" />
                <span>Save Current Voice Preset</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Preset Name *
                </label>
                <input
                  type="text"
                  required
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. My Stoic Reel Baritone, Midnight Storyteller..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Category
                </label>
                <select
                  value={presetCategory}
                  onChange={(e) =>
                    setPresetCategory(e.target.value as PresetCategory)
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Motivational">🔥 Motivational</option>
                  <option value="Storytelling">🎬 Storytelling</option>
                  <option value="Content Creation">⚡ Content Creation</option>
                  <option value="Broadcast & News">📰 Broadcast & News</option>
                  <option value="Literature & Poetry">📜 Literature & Poetry</option>
                  <option value="Meditation">🌙 Meditation</option>
                  <option value="Custom">⭐ Custom</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  placeholder="Short note about the vocal vibe or intended script..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Current Captured Specs Preview */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1 text-slate-400">
                <span className="font-semibold text-slate-300 block">
                  Tuning Snapshot Being Saved:
                </span>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="block text-slate-500">Voice</span>
                    <span className="text-white truncate block">{currentVoice}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Speed</span>
                    <span className="text-brand-300">
                      {((100 + currentRate) / 100).toFixed(2)}x ({currentRate >= 0 ? `+${currentRate}%` : `${currentRate}%`})
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Pitch</span>
                    <span className="text-indigo-300">
                      {currentPitch >= 0 ? `+${currentPitch}Hz` : `${currentPitch}Hz`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-600/30"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
