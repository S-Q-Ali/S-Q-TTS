import { NextRequest, NextResponse } from "next/server";
import { fetch as undiciFetch, Agent, FormData as UndiciFormData } from "undici";

export const runtime = "nodejs";

const agent = new Agent({
  headersTimeout: 60_000,
  bodyTimeout: 60_000,
});

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const speakerWav = formData.get("speaker_wav") as File | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Voice profile name is required" }, { status: 400 });
    }
    if (!speakerWav || speakerWav.size === 0) {
      return NextResponse.json({ error: "Reference audio file is required to save voice profile" }, { status: 400 });
    }

    const pyFormData = new UndiciFormData();
    pyFormData.append("name", name.trim());
    const audioBytes = await speakerWav.arrayBuffer();
    pyFormData.append(
      "speaker_wav",
      new Blob([audioBytes], { type: speakerWav.type || "audio/wav" }),
      speakerWav.name || "voice.wav"
    );

    const pyRes = await undiciFetch(`${PYTHON_SERVER_URL}/save-voice`, {
      method: "POST",
      body: pyFormData as any,
      dispatcher: agent,
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json({ error: `Server error: ${errText}` }, { status: pyRes.status });
    }

    const data = await pyRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save voice profile" }, { status: 500 });
  }
}
