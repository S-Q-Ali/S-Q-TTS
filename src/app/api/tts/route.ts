import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, rate, pitch, volume } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Text exceeds 5,000 character limit" },
        { status: 400 }
      );
    }

    const selectedVoice = voice || "ur-PK-UzmaNeural";
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 15000,
      synthesisTimeoutMs: 60000,
    });

    await tts.setMetadata(
      selectedVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    // Format prosody options
    const prosodyOptions: any = {};
    if (rate && rate !== "+0%" && rate !== "0%") prosodyOptions.rate = rate;
    if (pitch && pitch !== "+0Hz" && pitch !== "0Hz") prosodyOptions.pitch = pitch;
    if (volume && volume !== "+0%" && volume !== "0%") prosodyOptions.volume = volume;

    const { audioStream } = tts.toStream(text.trim(), prosodyOptions);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      audioStream.on("close", () => {
        resolve();
      });
      audioStream.on("error", (err: any) => {
        reject(err);
      });
    });

    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Content-Disposition": 'inline; filename="synthesized_speech.mp3"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate speech" },
      { status: 500 }
    );
  }
}
