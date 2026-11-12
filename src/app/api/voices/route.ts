import { NextResponse } from "next/server";
import { MsEdgeTTS } from "msedge-tts";

export const runtime = "nodejs";

// Cache voices in-memory to avoid fetching on every request
let cachedVoices: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cachedVoices && now - lastFetchTime < CACHE_TTL) {
      return NextResponse.json(cachedVoices);
    }

    const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000 });
    const rawVoices = await tts.getVoices();

    // Transform and map to standardized VoiceMetadata format
    const voices = rawVoices.map((v: any) => ({
      name: v.Name,
      shortName: v.ShortName,
      gender: v.Gender,
      locale: v.Locale,
      friendlyName: v.FriendlyName || v.ShortName,
      suggestedCodec: v.SuggestedCodec,
      status: v.Status,
    }));

    // Prioritize popular languages & featured voices (Brian, Jenny, Guy, Uzma, Asad)
    const priorityVoices = ["en-US-BrianNeural", "en-US-BrianMultilingualNeural", "en-US-JennyNeural", "en-US-GuyNeural"];
    const priorityLocales = ["en-US", "en-GB", "en-CA", "en-AU", "ur-PK", "ur-IN", "hi-IN", "ar-SA"];
    voices.sort((a, b) => {
      const aVoiceIdx = priorityVoices.indexOf(a.shortName);
      const bVoiceIdx = priorityVoices.indexOf(b.shortName);
      if (aVoiceIdx !== -1 && bVoiceIdx !== -1) return aVoiceIdx - bVoiceIdx;
      if (aVoiceIdx !== -1) return -1;
      if (bVoiceIdx !== -1) return 1;

      const aIndex = priorityLocales.indexOf(a.locale);
      const bIndex = priorityLocales.indexOf(b.locale);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.locale.localeCompare(b.locale);
    });

    cachedVoices = voices;
    lastFetchTime = now;

    return NextResponse.json(voices);
  } catch (error: any) {
    console.error("Error fetching voices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
