"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { TextInput } from "@/components/TextInput";
import { VoiceSelector } from "@/components/VoiceSelector";
import { VoiceControls } from "@/components/VoiceControls";
import { AudioPlayer } from "@/components/AudioPlayer";
import { HistoryList } from "@/components/HistoryList";
import { VoicePresetBar } from "@/components/VoicePresetBar";
import { VoiceMetadata, HistoryItem } from "@/lib/types";
import { VoicePreset } from "@/lib/voice-presets";
import { Preset } from "@/lib/presets";
import { Sparkles, Loader2, AlertCircle, Volume2, Shield } from "lucide-react";

export default function Home() {
  const [text, setText] = useState<string>(
    "Welcome to S-Q TTS Studio! Convert your written text into crystal-clear, natural neural speech powered by Microsoft Edge."
  );
  const [selectedVoice, setSelectedVoice] = useState<string>("en-US-JennyNeural");
  const [rate, setRate] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [autoCleanTags, setAutoCleanTags] = useState<boolean>(true);

  const [voices, setVoices] = useState<VoiceMetadata[]>([]);
  const [loadingVoices, setLoadingVoices] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentTextSnippet, setCurrentTextSnippet] = useState<string>("");
  const [currentVoiceLabel, setCurrentVoiceLabel] = useState<string>("");

  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load voices on mount
  useEffect(() => {
    async function fetchVoices() {
      try {
        setLoadingVoices(true);
        const res = await fetch("/api/voices");
        if (!res.ok) throw new Error("Failed to load voices list");
        const data = await res.json();
        setVoices(data);
      } catch (err: any) {
        console.error("Voices fetch error:", err);
        setError("Could not load voices list. Using default English neural voice.");
      } finally {
        setLoadingVoices(false);
      }
    }
    fetchVoices();
  }, []);

  // Apply a Voice Preset (Acoustic sound profile: Voice + Rate + Pitch + Volume)
  // Leaves the user's text untouched!
  const handleApplyVoicePreset = (preset: VoicePreset) => {
    setSelectedVoice(preset.voice);
    setRate(preset.rate);
    setPitch(preset.pitch);
    setVolume(preset.volume);
    setError(null);
  };

  // Handle sample script idea selection (Only fills in text)
  const handleSelectPreset = (preset: Preset) => {
    setText(preset.text);
    setError(null);
  };

  // Reset voice tuning sliders
  const handleResetControls = () => {
    setRate(0);
    setPitch(0);
    setVolume(0);
  };

  // Generate speech handler
  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter some text to synthesize!");
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // Convert rate, pitch, and volume into SSML-compatible string formats
      const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
      const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;
      const volumeStr = volume >= 0 ? `+${volume}%` : `${volume}%`;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          rate: rateStr,
          pitch: pitchStr,
          volume: volumeStr,
          autoClean: autoCleanTags,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Generation failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      // Update current playing state
      setCurrentAudioUrl(audioUrl);
      setCurrentTextSnippet(text.trim());
      setCurrentVoiceLabel(selectedVoice);

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        text: text.trim(),
        voice: selectedVoice,
        voiceLabel: selectedVoice,
        timestamp: Date.now(),
        audioUrl,
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error("TTS generation error:", err);
      setError(err.message || "Failed to generate audio. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayHistoryItem = (item: HistoryItem) => {
    setCurrentAudioUrl(item.audioUrl);
    setCurrentTextSnippet(item.text);
    setCurrentVoiceLabel(item.voiceLabel);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error notification banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Audio Player if generated */}
        <AudioPlayer
          audioUrl={currentAudioUrl}
          textSnippet={currentTextSnippet}
          voiceLabel={currentVoiceLabel}
        />

        {/* Dedicated Voice Preset & Acoustic Profile Bar */}
        <VoicePresetBar
          currentVoice={selectedVoice}
          currentRate={rate}
          currentPitch={pitch}
          currentVolume={volume}
          onApplyPreset={handleApplyVoicePreset}
          disabled={isGenerating}
        />

        {/* Main studio layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Text Input & Prosody Controls */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-5 sm:p-6 rounded-3xl shadow-xl space-y-6">
              <TextInput
                text={text}
                onChange={setText}
                onSelectPreset={handleSelectPreset}
                autoCleanTags={autoCleanTags}
                onToggleAutoClean={setAutoCleanTags}
                disabled={isGenerating}
              />

              <VoiceControls
                rate={rate}
                pitch={pitch}
                volume={volume}
                onRateChange={setRate}
                onPitchChange={setPitch}
                onVolumeChange={setVolume}
                onReset={handleResetControls}
                disabled={isGenerating}
              />

              {/* Generate Action Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 bg-[length:200%_auto] hover:bg-right text-white font-semibold text-sm shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Synthesizing Voice... (Please wait)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Generate Speech (Convert to Audio)</span>
                  </>
                )}
              </button>
            </div>

            {/* History List */}
            <HistoryList
              history={history}
              onPlayItem={handlePlayHistoryItem}
              onDeleteItem={handleDeleteHistoryItem}
              onClearAll={handleClearHistory}
            />
          </div>

          {/* Right Column: Voice Selection and Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-5 sm:p-6 rounded-3xl shadow-xl">
              <VoiceSelector
                voices={voices}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                loading={loadingVoices}
              />
            </div>

            {/* Info Card */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>Feature Highlights</span>
              </div>
              <ul className="space-y-1 list-disc list-inside text-slate-400 leading-relaxed">
                <li>300+ Microsoft Edge Neural Voices across 70+ languages.</li>
                <li>Native English voices (<code className="text-blue-400">en-US-Jenny</code>, <code className="text-blue-400">en-US-Guy</code>, <code className="text-blue-400">en-GB-Sonia</code>) and Urdu (<code className="text-emerald-400">ur-PK-Uzma</code>, <code className="text-emerald-400">ur-PK-Asad</code>).</li>
                <li>Direct high-bitrate MP3 download capability.</li>
                <li>Zero subscriptions, 100% free forever.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        <p>
          S-Q TTS Studio • Built with Next.js, React, Tailwind CSS & Microsoft Edge Neural TTS
        </p>
      </footer>
    </div>
  );
}
