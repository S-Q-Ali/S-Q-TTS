export interface DetectedTag {
  raw: string; // e.g. "[Soft and reflective]"
  content: string; // "Soft and reflective"
  type: "pause" | "emotion" | "direction";
  pauseDurationMs?: number;
  action: "pause" | "strip";
}

export interface ScriptParseResult {
  cleanedText: string;
  detectedTags: DetectedTag[];
  hasTags: boolean;
}

/**
 * 3-Tier Dynamic Pattern Classifier for Stage Directions & Script Cues
 */
export function parseScriptTags(inputText: string): ScriptParseResult {
  if (!inputText || !inputText.trim()) {
    return { cleanedText: "", detectedTags: [], hasTags: false };
  }

  const detectedTags: DetectedTag[] = [];
  // Regex to match anything inside square brackets [...] or explicit parentheses directions (...), e.g. (pause)
  const bracketRegex = /\[([^\]]+)\]/g;

  let cleaned = inputText;

  let match: RegExpExecArray | null;
  const tagList: Array<{ fullMatch: string; inner: string; index: number }> = [];

  while ((match = bracketRegex.exec(inputText)) !== null) {
    tagList.push({
      fullMatch: match[0],
      inner: match[1].trim(),
      index: match.index,
    });
  }

  if (tagList.length === 0) {
    return { cleanedText: inputText, detectedTags: [], hasTags: false };
  }

  // Regex intent patterns
  const pauseKeywordsRegex = /\b(pause|silence|wait|break|breath|gap|stop|سکوت|وقفہ)\b/i;
  const timeExtractRegex = /(\d+(\.\d+)?)\s*(s|sec|seconds|ms)/i;

  tagList.forEach((tag) => {
    const raw = tag.fullMatch;
    const inner = tag.inner;
    const lower = inner.toLowerCase();

    const isPause = pauseKeywordsRegex.test(lower);

    if (isPause) {
      // Determine pause length
      let durationMs = 1000;
      const timeMatch = lower.match(timeExtractRegex);
      if (timeMatch) {
        const val = parseFloat(timeMatch[1]);
        const unit = timeMatch[3].toLowerCase();
        durationMs = unit.startsWith("ms") ? val : val * 1000;
      } else if (lower.includes("short") || lower.includes("brief") || lower.includes("small") || lower.includes("ہلکا")) {
        durationMs = 800;
      } else if (lower.includes("long") || lower.includes("deep") || lower.includes("heavy") || lower.includes("لمبا")) {
        durationMs = 2000;
      }

      detectedTags.push({
        raw,
        content: inner,
        type: "pause",
        pauseDurationMs: durationMs,
        action: "pause",
      });

      // Map pause to rhythmic punctuation for Neural TTS:
      // A longer pause gets extended ellipsis and line break
      const pauseReplacement = durationMs >= 1500 ? "......\n\n" : "...\n";
      cleaned = cleaned.replace(raw, pauseReplacement);
    } else {
      // Emotion or general stage direction (e.g. [Gentle sadness], [Soft and reflective], [Thoughtful], [Whispers])
      detectedTags.push({
        raw,
        content: inner,
        type: lower.includes("tone") || lower.includes("voice") || lower.includes("sad") || lower.includes("soft") ? "emotion" : "direction",
        action: "strip",
      });

      // Strip stage direction so voice does not read it aloud
      // If it is at the start of a line or followed by text, preserve clean flow
      cleaned = cleaned.replace(raw, "");
    }
  });

  // Tidy up duplicate spaces, multiple empty lines, and dangling ellipses
  cleaned = cleaned
    .replace(/[ \t]+/g, " ") // Collapse multiple spaces
    .replace(/\n\s*\n\s*\n+/g, "\n\n") // Max 2 line breaks
    .replace(/\.\.\.\s*\.\.\./g, "...") // Collapse doubled ellipses
    .trim();

  return {
    cleanedText: cleaned,
    detectedTags,
    hasTags: detectedTags.length > 0,
  };
}
