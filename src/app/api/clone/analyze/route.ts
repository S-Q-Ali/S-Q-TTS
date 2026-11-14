import { NextRequest, NextResponse } from "next/server";
import { fetch as undiciFetch, Agent, FormData as UndiciFormData } from "undici";

export const runtime = "nodejs";

const analyzeAgent = new Agent({
  headersTimeout: 30_000,
  bodyTimeout: 30_000,
  connectTimeout: 10_000,
});

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

// POST /api/clone/analyze - Rapid acoustic pace & speaking rate analysis
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const speakerWav = formData.get("speaker_wav") as File | null;
    const voiceName = formData.get("voice_name") as string | null;

    const pyFormData = new UndiciFormData();
    let targetEndpoint = `${PYTHON_SERVER_URL}/analyze-voice`;

    if (speakerWav && speakerWav.size > 0) {
      const audioBytes = await speakerWav.arrayBuffer();
      pyFormData.append(
        "speaker_wav",
        new Blob([audioBytes], { type: speakerWav.type || "audio/wav" }),
        speakerWav.name || "reference.wav"
      );
    } else if (voiceName) {
      pyFormData.append("voice_name", voiceName);
      targetEndpoint = `${PYTHON_SERVER_URL}/analyze-saved-voice`;
    } else {
      return NextResponse.json(
        { error: "Audio file or voice_name is required for acoustic analysis" },
        { status: 400 }
      );
    }

    const pyRes = await undiciFetch(targetEndpoint, {
      method: "POST",
      body: pyFormData as any,
      signal: AbortSignal.timeout(15_000),
      dispatcher: analyzeAgent,
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json(
        { error: `Analysis failed: ${errText}` },
        { status: pyRes.status }
      );
    }

    const data = await pyRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Acoustic analysis error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to analyze voice pace",
        duration_sec: 0,
        sps: 4.1,
        wpm: 135,
        pace_label: "Standard Pace",
        recommended_speed: 1.0,
      },
      { status: 500 }
    );
  }
}
