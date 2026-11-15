import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { parseScriptTags } from "@/lib/script-parser";
import { fetch as undiciFetch, Agent, FormData as UndiciFormData } from "undici";

export const runtime = "nodejs";

const hybridAgent = new Agent({
  headersTimeout: 600_000, // 10 minutes
  bodyTimeout: 600_000,
  connectTimeout: 30_000,
});

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

// POST /api/clone/hybrid - Option A: Microsoft Neural TTS -> Cloned Voice Conversion
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const msVoice = (formData.get("msVoice") as string) || "en-US-JennyNeural";
    const voiceName = (formData.get("voice_name") as string) || "";
    const speakerWav = formData.get("speaker_wav") as File | null;
    const speed = (formData.get("speed") as string) || "1.0";
    const autoClean = formData.get("autoClean") !== "false";

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text cannot be empty" }, { status: 400 });
    }

    if (!voiceName && !speakerWav) {
      return NextResponse.json(
        { error: "Please select a saved voice profile or upload a voice reference sample." },
        { status: 400 }
      );
    }

    // Process text
    const processedText = autoClean ? parseScriptTags(text.trim()).cleanedText : text.trim();

    // ── Phase 1: Synthesize pristine Microsoft Neural Audio ──
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 15_000,
      synthesisTimeoutMs: 60_000,
    });

    await tts.setMetadata(msVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(processedText);
    const msChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => msChunks.push(chunk));
      audioStream.on("close", () => resolve());
      audioStream.on("error", (err: any) => reject(err));
    });

    const msAudioBuffer = Buffer.concat(msChunks);

    // ── Phase 2: Convert to Cloned Voice using ChatterboxVC on Python Backend ──
    const pyFormData = new UndiciFormData();
    pyFormData.append(
      "source_audio",
      new Blob([msAudioBuffer], { type: "audio/mpeg" }),
      "source_ms.mp3"
    );
    pyFormData.append("speed", speed);

    if (voiceName) {
      pyFormData.append("voice_name", voiceName);
    } else if (speakerWav) {
      const wavBytes = await speakerWav.arrayBuffer();
      pyFormData.append(
        "target_wav",
        new Blob([wavBytes], { type: speakerWav.type || "audio/wav" }),
        speakerWav.name || "reference.wav"
      );
    }

    const pyRes = await undiciFetch(`${PYTHON_SERVER_URL}/convert-voice`, {
      method: "POST",
      body: pyFormData as any,
      dispatcher: hybridAgent,
      signal: AbortSignal.timeout(600_000),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json(
        { error: `Voice Conversion failed: ${errText}` },
        { status: pyRes.status }
      );
    }

    const arrayBuffer = await pyRes.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'attachment; filename="hybrid_cloned.wav"',
        "Content-Length": arrayBuffer.byteLength.toString(),
        "X-Engine": "ms-edge-tts + chatterbox-vc",
      },
    });
  } catch (err: any) {
    console.error("Hybrid cloning error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate hybrid cloned speech" },
      { status: 500 }
    );
  }
}
