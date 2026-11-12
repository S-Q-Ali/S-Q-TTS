export type PresetCategory =
  | "Motivational"
  | "Storytelling"
  | "Content Creation"
  | "Broadcast & News"
  | "Literature & Poetry"
  | "Meditation"
  | "Custom";

export interface VoicePreset {
  id: string;
  name: string;
  category: PresetCategory;
  gender: "Female" | "Male";
  icon: string;
  voice: string;
  rate: number; // percentage (-50 to +100)
  pitch: number; // Hz (-50 to +50)
  volume: number; // percentage (-50 to +50)
  description: string;
  isBuiltIn: boolean;
  createdAt?: number;
}

export const BUILT_IN_VOICE_PRESETS: VoicePreset[] = [
  // --- FEMALE PRESETS ---
  {
    id: "preset_emma_poetic",
    name: "Gentle & Reflective (Emma)",
    category: "Storytelling",
    gender: "Female",
    icon: "🌸",
    voice: "en-US-EmmaMultilingualNeural",
    rate: -8,
    pitch: -2,
    volume: 0,
    description: "Heartfelt, soft, and deeply emotional tone. The female counterpart for midnight thoughts, sad poetry, and heartfelt reflections.",
    isBuiltIn: true,
  },
  {
    id: "preset_ava_reel",
    name: "Viral Shorts / TikTok (Ava)",
    category: "Content Creation",
    gender: "Female",
    icon: "✨",
    voice: "en-US-AvaNeural",
    rate: 0,
    pitch: 0,
    volume: 0,
    description: "Modern, dynamic, vibrant voice widely popular across social media reels, lifestyle vlogs, and podcasts.",
    isBuiltIn: true,
  },
  {
    id: "preset_sonia_calm",
    name: "British Mindfulness (Sonia)",
    category: "Meditation",
    gender: "Female",
    icon: "🧘‍♀️",
    voice: "en-GB-SoniaNeural",
    rate: -15,
    pitch: -2,
    volume: -5,
    description: "Soothing British RP accent with calm, tranquil pacing for bedtime stories, meditation, and guided relaxation.",
    isBuiltIn: true,
  },
  {
    id: "preset_urdu_host_female",
    name: "شائستہ اردو میزبان (Uzma)",
    category: "Literature & Poetry",
    gender: "Female",
    icon: "🇵🇰",
    voice: "ur-PK-UzmaNeural",
    rate: -5,
    pitch: 0,
    volume: 0,
    description: "شائستہ اور فطری اردو لب و لہجہ، پوڈکاسٹ، معلوماتی ویڈیوز اور جذباتی اشعار کے لیے۔",
    isBuiltIn: true,
  },
  {
    id: "preset_jenny_news",
    name: "Professional News Anchor (Jenny)",
    category: "Broadcast & News",
    gender: "Female",
    icon: "📰",
    voice: "en-US-JennyNeural",
    rate: 8,
    pitch: 1,
    volume: 0,
    description: "Crisp, authoritative, articulate broadcast cadence for journalism, corporate explainers, and announcements.",
    isBuiltIn: true,
  },

  // --- MALE PRESETS ---
  {
    id: "preset_stoic_reel",
    name: "Stoic Viral Reel (Brian)",
    category: "Motivational",
    gender: "Male",
    icon: "🔥",
    voice: "en-US-BrianNeural",
    rate: -10,
    pitch: -4,
    volume: 0,
    description: "Deep, chest-resonant baritone with deliberate pauses. The viral gold standard for motivational quotes.",
    isBuiltIn: true,
  },
  {
    id: "preset_epic_cinema",
    name: "Epic Movie Trailer (Christopher)",
    category: "Storytelling",
    gender: "Male",
    icon: "🎬",
    voice: "en-US-ChristopherNeural",
    rate: -15,
    pitch: -6,
    volume: 5,
    description: "Heavy, commanding baritone for movie trailers, game intros, and dark history narrations.",
    isBuiltIn: true,
  },
  {
    id: "preset_audiobook",
    name: "Audiobook Narrator (Ryan)",
    category: "Storytelling",
    gender: "Male",
    icon: "📖",
    voice: "en-GB-RyanNeural",
    rate: -5,
    pitch: -1,
    volume: 0,
    description: "Refined British RP cadence with smooth articulation, perfect for non-fatiguing long-form listening.",
    isBuiltIn: true,
  },
  {
    id: "preset_youtube_explainer",
    name: "YouTube Tech Explainer (Guy)",
    category: "Content Creation",
    gender: "Male",
    icon: "⚡",
    voice: "en-US-GuyNeural",
    rate: 5,
    pitch: 0,
    volume: 0,
    description: "Energetic, engaging, and friendly delivery tailored for YouTube tutorials and faceless videos.",
    isBuiltIn: true,
  },
  {
    id: "preset_urdu_dastan",
    name: "اردو داستان گوئی (Asad)",
    category: "Literature & Poetry",
    gender: "Male",
    icon: "📜",
    voice: "ur-PK-AsadNeural",
    rate: -8,
    pitch: -3,
    volume: 0,
    description: "گہرا اور پروقار لحن، اردو ادب، تاریخ اور شاعری کے لیے موزوں۔",
    isBuiltIn: true,
  },
];

const STORAGE_KEY = "sq_tts_custom_voice_presets";

export function getStoredCustomPresets(): VoicePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading custom presets from localStorage:", err);
    return [];
  }
}

export function saveCustomPresetToStorage(
  preset: Omit<VoicePreset, "id" | "isBuiltIn" | "createdAt">
): VoicePreset {
  const customPresets = getStoredCustomPresets();
  const newPreset: VoicePreset = {
    ...preset,
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isBuiltIn: false,
    createdAt: Date.now(),
  };

  const updated = [newPreset, ...customPresets];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return newPreset;
}

export function deleteCustomPresetFromStorage(id: string): void {
  const customPresets = getStoredCustomPresets();
  const filtered = customPresets.filter((p) => p.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
}

export function exportPresetsAsJSON(presets: VoicePreset[]): void {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(presets, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sq_tts_voice_presets_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importPresetsFromJSON(jsonString: string): VoicePreset[] {
  const parsed = JSON.parse(jsonString);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid format: expected an array of presets");
  }

  const validPresets: VoicePreset[] = parsed.filter(
    (item) => item.name && item.voice && typeof item.rate === "number"
  );

  const existing = getStoredCustomPresets();
  const existingNames = new Set(existing.map((e) => e.name));
  const newItems = validPresets.filter((p) => !existingNames.has(p.name));
  const combined = [...newItems, ...existing];

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
  }
  return combined;
}
