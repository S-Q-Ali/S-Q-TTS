"use client";

import React, { useState, useMemo } from "react";
import { Search, User, Filter, Globe, Check, Mic } from "lucide-react";
import { VoiceMetadata } from "@/lib/types";

interface VoiceSelectorProps {
  voices: VoiceMetadata[];
  selectedVoice: string;
  onSelectVoice: (voiceShortName: string) => void;
  loading?: boolean;
}

export function VoiceSelector({
  voices,
  selectedVoice,
  onSelectVoice,
  loading = false,
}: VoiceSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("ALL");
  const [selectedLanguageGroup, setSelectedLanguageGroup] = useState<string>("ALL");

  // Filter voices based on search, gender, and language tabs
  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      // Search filter
      const matchesSearch =
        !search ||
        v.shortName.toLowerCase().includes(search.toLowerCase()) ||
        v.friendlyName.toLowerCase().includes(search.toLowerCase()) ||
        v.locale.toLowerCase().includes(search.toLowerCase());

      // Gender filter
      const matchesGender =
        selectedGender === "ALL" ||
        v.gender.toLowerCase() === selectedGender.toLowerCase();

      // Language group quick filter
      let matchesLang = true;
      if (selectedLanguageGroup === "URDU") {
        matchesLang = v.locale.toLowerCase().startsWith("ur");
      } else if (selectedLanguageGroup === "ENGLISH") {
        matchesLang = v.locale.toLowerCase().startsWith("en");
      } else if (selectedLanguageGroup === "ARABIC") {
        matchesLang = v.locale.toLowerCase().startsWith("ar");
      } else if (selectedLanguageGroup === "HINDI") {
        matchesLang = v.locale.toLowerCase().startsWith("hi");
      }

      return matchesSearch && matchesGender && matchesLang;
    });
  }, [voices, search, selectedGender, selectedLanguageGroup]);

  const activeVoiceObj = useMemo(() => {
    return voices.find((v) => v.shortName === selectedVoice);
  }, [voices, selectedVoice]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Mic className="h-4 w-4 text-brand-400" />
          <span>AI Voice Selection</span>
        </label>
        {activeVoiceObj && (
          <span className="text-xs text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full font-medium">
            Active: {activeVoiceObj.shortName}
          </span>
        )}
      </div>

      {/* Quick Language Filters */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          { id: "ALL", label: "All Languages" },
          { id: "URDU", label: "🇵🇰 Urdu (اردو)" },
          { id: "ENGLISH", label: "🇬🇧/🇺🇸 English" },
          { id: "ARABIC", label: "🇸🇦 Arabic (عربي)" },
          { id: "HINDI", label: "🇮🇳 Hindi (हिन्दी)" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedLanguageGroup(tab.id)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              selectedLanguageGroup === tab.id
                ? "bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-600/30 font-medium"
                : "bg-slate-900/60 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Gender Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voice name or code (e.g. Asad, Uzma, Jenny, en-US)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900/60 border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer"
        >
          <option value="ALL">All Genders</option>
          <option value="Female">Female</option>
          <option value="Male">Male</option>
        </select>
      </div>

      {/* Voice List Scroll Area */}
      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 rounded-2xl border border-white/5 bg-slate-950/40 p-2">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Loading 300+ Microsoft Neural Voices...
          </div>
        ) : filteredVoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No voices found matching "{search}".
          </div>
        ) : (
          filteredVoices.map((v) => {
            const isSelected = v.shortName === selectedVoice;
            const isUrdu = v.locale.toLowerCase().startsWith("ur");

            return (
              <button
                key={v.shortName}
                onClick={() => onSelectVoice(v.shortName)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-brand-500/15 border-brand-500/50 shadow-sm text-white ring-1 ring-brand-500/30"
                    : "bg-slate-900/40 border-white/5 hover:bg-slate-800/60 text-slate-300 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                      isSelected
                        ? "bg-brand-600 text-white"
                        : isUrdu
                        ? "bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {v.gender === "Female" ? "♀" : "♂"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{v.shortName}</span>
                      {isUrdu && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-medium">
                          Urdu
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate max-w-[240px]">
                      {v.friendlyName} • {v.locale}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center text-white shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
