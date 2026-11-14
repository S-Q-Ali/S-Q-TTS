export type TagCategory = "pause" | "emotion" | "delivery" | "reaction" | "direction";

export interface DetectedTag {
  raw: string; // e.g. "[Soft and reflective]" or "(whispering)"
  content: string; // "Soft and reflective"
  category: TagCategory;
  type: TagCategory; // backwards-compatible alias
  pauseDurationMs?: number;
  action: "pause" | "strip";
  description?: string;
}

export interface AcousticRecommendation {
  suggestedExaggeration?: number; // 0.0 - 1.0 for voice cloning
  suggestedRate?: string; // "-15%", "+10%" for standard TTS
  suggestedPitch?: string; // "-4Hz", "+6Hz" for standard TTS
  dominantMood: string; // e.g. "Reflective & Intimate", "Dramatic & Urgent"
}

export interface ScriptParseResult {
  cleanedText: string;
  detectedTags: DetectedTag[];
  hasTags: boolean;
  recommendation: AcousticRecommendation;
}

// ─── Semantic Dictionaries (English, Urdu, and Roman Urdu) ──────────

const PAUSE_PATTERNS = [
  "pause", "silence", "wait", "break", "breath", "breathing", "gap", "stop",
  "dramatic pause", "brief pause", "long pause", "short pause", "deep breath",
  "وقفہ", "سکوت", "ٹھہراؤ", "سانس", "لمبا وقفہ", "مختصر وقفہ",
  "waqfa", "thehraw", "thahrao", "saans", "rok",
];

const EMOTION_PATTERNS: Record<string, { mood: string; exaggeration: number; rate: string; pitch: string }> = {
  // Melancholy / Sorrow
  sad: { mood: "Melancholic & Sorrowful", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },
  sadness: { mood: "Melancholic & Sorrowful", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },
  melancholy: { mood: "Deeply Melancholic", exaggeration: 0.35, rate: "-15%", pitch: "-4Hz" },
  melancholic: { mood: "Deeply Melancholic", exaggeration: 0.35, rate: "-15%", pitch: "-4Hz" },
  heartbroken: { mood: "Heartbroken", exaggeration: 0.4, rate: "-20%", pitch: "-6Hz" },
  grief: { mood: "Somber Grief", exaggeration: 0.3, rate: "-20%", pitch: "-5Hz" },
  gloomy: { mood: "Gloomy", exaggeration: 0.3, rate: "-10%", pitch: "-4Hz" },
  mournful: { mood: "Mournful", exaggeration: 0.35, rate: "-15%", pitch: "-5Hz" },
  udas: { mood: "Udaas / Melancholic", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },
  udasi: { mood: "Udaasi / Sorrow", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },
  غمگین: { mood: "Ghamgeen", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },
  اداس: { mood: "Udaas", exaggeration: 0.3, rate: "-15%", pitch: "-5Hz" },

  // Soft / Reflective / Intimate
  soft: { mood: "Soft & Reflective", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },
  softly: { mood: "Soft & Reflective", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },
  reflective: { mood: "Reflective & Thoughtful", exaggeration: 0.4, rate: "-10%", pitch: "-2Hz" },
  thoughtful: { mood: "Thoughtful & Philosophical", exaggeration: 0.4, rate: "-10%", pitch: "-3Hz" },
  gentle: { mood: "Gentle & Warm", exaggeration: 0.4, rate: "-5%", pitch: "0Hz" },
  gently: { mood: "Gentle & Tender", exaggeration: 0.4, rate: "-5%", pitch: "0Hz" },
  calm: { mood: "Calm & Centered", exaggeration: 0.35, rate: "-5%", pitch: "-2Hz" },
  peaceful: { mood: "Peaceful", exaggeration: 0.3, rate: "-10%", pitch: "-2Hz" },
  serene: { mood: "Serene & Peaceful", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },
  stoic: { mood: "Stoic & Steady", exaggeration: 0.25, rate: "-5%", pitch: "-4Hz" },
  intimate: { mood: "Intimate & Close", exaggeration: 0.45, rate: "-10%", pitch: "-3Hz" },
  dheemi: { mood: "Dheemi Awaz / Gentle", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },
  پُرسکون: { mood: "Pur-Sukoon", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },
  دھیمی: { mood: "Dheemi Awaz", exaggeration: 0.35, rate: "-10%", pitch: "-2Hz" },

  // Dramatic / Intense / Urgent
  dramatic: { mood: "Cinematic & Dramatic", exaggeration: 0.75, rate: "-5%", pitch: "+2Hz" },
  intense: { mood: "Intense & Gripping", exaggeration: 0.8, rate: "+5%", pitch: "+4Hz" },
  urgent: { mood: "Urgent & High-Stakes", exaggeration: 0.85, rate: "+20%", pitch: "+6Hz" },
  urgency: { mood: "Urgent & High-Stakes", exaggeration: 0.85, rate: "+20%", pitch: "+6Hz" },
  suspenseful: { mood: "Suspenseful & Tense", exaggeration: 0.7, rate: "-10%", pitch: "+3Hz" },
  tense: { mood: "Tense & Anxious", exaggeration: 0.75, rate: "+10%", pitch: "+5Hz" },
  fearful: { mood: "Fearful & Shaken", exaggeration: 0.8, rate: "+10%", pitch: "+6Hz" },
  angry: { mood: "Fierce & Angry", exaggeration: 0.9, rate: "+15%", pitch: "+8Hz" },
  furious: { mood: "Furious", exaggeration: 0.95, rate: "+20%", pitch: "+10Hz" },
  غصہ: { mood: "Ghussa / Angry", exaggeration: 0.9, rate: "+15%", pitch: "+8Hz" },
  خوفزدہ: { mood: "Khaufzada / Fearful", exaggeration: 0.8, rate: "+10%", pitch: "+6Hz" },

  // Uplifting / Hopeful / Inspiring
  inspiring: { mood: "Inspiring & Uplifting", exaggeration: 0.65, rate: "+5%", pitch: "+3Hz" },
  hopeful: { mood: "Hopeful & Sincere", exaggeration: 0.6, rate: "+0%", pitch: "+2Hz" },
  excited: { mood: "Excited & Joyful", exaggeration: 0.85, rate: "+15%", pitch: "+8Hz" },
  joyful: { mood: "Joyful & Energetic", exaggeration: 0.8, rate: "+10%", pitch: "+6Hz" },
  happy: { mood: "Happy & Warm", exaggeration: 0.7, rate: "+5%", pitch: "+4Hz" },
  passionate: { mood: "Passionate & Convincing", exaggeration: 0.75, rate: "+5%", pitch: "+3Hz" },
  confident: { mood: "Confident & Authoritative", exaggeration: 0.6, rate: "+0%", pitch: "-2Hz" },
  authoritative: { mood: "Authoritative & Deep", exaggeration: 0.55, rate: "-5%", pitch: "-5Hz" },
  پرجوش: { mood: "Pur-Josh / Excited", exaggeration: 0.85, rate: "+15%", pitch: "+8Hz" },
  خوشی: { mood: "Khushi / Joyful", exaggeration: 0.8, rate: "+10%", pitch: "+6Hz" },
};

const DELIVERY_PATTERNS = [
  "whisper", "whispers", "whispering", "murmur", "murmuring", "shout", "shouting",
  "yell", "breathy", "soft-spoken", "monotone", "fast", "slow", "deep resonance",
  "raspy", "trembling", "husky", "under breath",
  "سرگوشی", "زیرِ لب", "چیخ", "کھردری آواز", "دھیمی پچ",
  "sargoshi", "zer-e-lab", "chheekh",
];

const REACTION_PATTERNS = [
  "sigh", "sighs", "sighing", "deep sigh", "chuckle", "chuckles", "laugh",
  "laughs", "laughing", "gasp", "gasps", "crying", "sobbing", "gulps",
  "clears throat", "throat clear", "snicker", "yawn",
  "آہ", "ہنسی", "سسکی", "ہچکی", "کھانسنا",
  "aah", "hansi", "siski",
];

/**
 * 4-Tier Pattern Classifier for Scripts:
 * Recognizes square brackets [...], parentheses (...), curly braces {...}, and action asterisks *...*
 */
export function parseScriptTags(inputText: string): ScriptParseResult {
  if (!inputText || !inputText.trim()) {
    return {
      cleanedText: "",
      detectedTags: [],
      hasTags: false,
      recommendation: { dominantMood: "Neutral & Natural", suggestedExaggeration: 0.5 },
    };
  }

  const detectedTags: DetectedTag[] = [];

  // Match:
  // 1. [Square Brackets]
  // 2. (Round Parentheses) containing cues
  // 3. *Action Asterisks*
  // 4. {Curly Braces}
  const tagRegex = /(\[([^\]]+)\])|(\(([^)]+)\))|(\*([^*]+)\*)|(\{([^}]+)\})/g;

  let cleaned = inputText;
  let match: RegExpExecArray | null;

  interface TagItem {
    raw: string;
    inner: string;
  }
  const foundTags: TagItem[] = [];

  while ((match = tagRegex.exec(inputText)) !== null) {
    const raw = match[0];
    const inner = (match[2] || match[4] || match[6] || match[8] || "").trim();
    if (inner.length > 0 && inner.length <= 60) {
      foundTags.push({ raw, inner });
    }
  }

  if (foundTags.length === 0) {
    return {
      cleanedText: inputText,
      detectedTags: [],
      hasTags: false,
      recommendation: { dominantMood: "Neutral & Natural", suggestedExaggeration: 0.5 },
    };
  }

  const timeExtractRegex = /(\d+(\.\d+)?)\s*(s|sec|seconds|ms)/i;
  let detectedMoodScore = { mood: "Natural Narrative", exaggeration: 0.5, rate: "+0%", pitch: "+0Hz", count: 0 };

  foundTags.forEach((tag) => {
    const raw = tag.raw;
    const inner = tag.inner;
    const lower = inner.toLowerCase();

    // 1. Check for Pause
    const isPause = PAUSE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));

    if (isPause) {
      let durationMs = 1000;
      const timeMatch = lower.match(timeExtractRegex);
      if (timeMatch) {
        const val = parseFloat(timeMatch[1]);
        const unit = timeMatch[3].toLowerCase();
        durationMs = unit.startsWith("ms") ? val : Math.round(val * 1000);
      } else if (lower.includes("micro") || lower.includes("tiny") || lower.includes("ہلکا")) {
        durationMs = 400;
      } else if (lower.includes("short") || lower.includes("brief") || lower.includes("small") || lower.includes("مختصر")) {
        durationMs = 800;
      } else if (lower.includes("long") || lower.includes("deep") || lower.includes("heavy") || lower.includes("لمبا") || lower.includes("dramatic")) {
        durationMs = 2000;
      }

      detectedTags.push({
        raw,
        content: inner,
        category: "pause",
        type: "pause",
        pauseDurationMs: durationMs,
        action: "pause",
        description: `${(durationMs / 1000).toFixed(1)}s Natural Silence`,
      });

      // Adaptive rhythmic punctuation for natural speech pauses
      let pauseReplacement = " ... ";
      if (durationMs < 600) {
        pauseReplacement = ", ";
      } else if (durationMs >= 1800) {
        pauseReplacement = " ...... \n\n";
      } else {
        pauseReplacement = " ... \n";
      }

      cleaned = cleaned.replace(raw, pauseReplacement);
      return;
    }

    // 2. Check for Delivery Cue
    const isDelivery = DELIVERY_PATTERNS.some((d) => lower.includes(d.toLowerCase()));
    if (isDelivery) {
      detectedTags.push({
        raw,
        content: inner,
        category: "delivery",
        type: "delivery",
        action: "strip",
        description: "Delivery Mode",
      });
      cleaned = cleaned.replace(raw, "");
      if (lower.includes("whisper") || lower.includes("سرگوشی")) {
        detectedMoodScore = { mood: "Whispered & Intimate", exaggeration: 0.25, rate: "-15%", pitch: "-4Hz", count: detectedMoodScore.count + 1 };
      }
      return;
    }

    // 3. Check for Physical Reaction
    const isReaction = REACTION_PATTERNS.some((r) => lower.includes(r.toLowerCase()));
    if (isReaction) {
      detectedTags.push({
        raw,
        content: inner,
        category: "reaction",
        type: "reaction",
        action: "strip",
        description: "Character Reaction",
      });
      cleaned = cleaned.replace(raw, " ... ");
      return;
    }

    // 4. Check for Emotional Direction
    let matchedEmotionKey = "";
    for (const key of Object.keys(EMOTION_PATTERNS)) {
      if (lower.includes(key)) {
        matchedEmotionKey = key;
        break;
      }
    }

    if (matchedEmotionKey) {
      const em = EMOTION_PATTERNS[matchedEmotionKey];
      detectedTags.push({
        raw,
        content: inner,
        category: "emotion",
        type: "emotion",
        action: "strip",
        description: em.mood,
      });
      cleaned = cleaned.replace(raw, "");
      detectedMoodScore = {
        mood: em.mood,
        exaggeration: em.exaggeration,
        rate: em.rate,
        pitch: em.pitch,
        count: detectedMoodScore.count + 1,
      };
      return;
    }

    // 5. Fallback Stage Direction (Muted safely so voice never speaks brackets)
    detectedTags.push({
      raw,
      content: inner,
      category: "direction",
      type: "direction",
      action: "strip",
      description: "Stage Cue",
    });
    cleaned = cleaned.replace(raw, "");
  });

  // Tidy up duplicate spaces, multiple empty lines, and dangling ellipses
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/\.\.\.\s*\.\.\./g, "...")
    .trim();

  return {
    cleanedText: cleaned,
    detectedTags,
    hasTags: detectedTags.length > 0,
    recommendation: {
      dominantMood: detectedMoodScore.mood,
      suggestedExaggeration: detectedMoodScore.exaggeration,
      suggestedRate: detectedMoodScore.rate,
      suggestedPitch: detectedMoodScore.pitch,
    },
  };
}
