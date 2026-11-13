import { NextRequest, NextResponse } from "next/server";
import { parseScriptTags } from "@/lib/script-parser";

export const runtime = "nodejs";

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

// GET /api/clone - Check Python server health & list saved voices
export async function GET() {
  try {
    const healthRes = await fetch(`${PYTHON_SERVER_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3000), // 3s timeout to avoid hanging
    });

    if (!healthRes.ok) {
      return NextResponse.json({
        online: false,
        status: "unhealthy",
        message: "Voice clone server is reachable but returned an unhealthy status.",
      });
    }

    const healthData = await healthRes.json();

    // Fetch saved voices list
    let voices = [];
    try {
      const voicesRes = await fetch(`${PYTHON_SERVER_URL}/voices`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (voicesRes.ok) {
        const vData = await voicesRes.json();
        voices = vData.voices || [];
      }
    } catch {
      // ignore secondary voices error
    }

    return NextResponse.json({
      online: true,
      status: "ready",
      device: healthData.device,
      modelLoaded: healthData.model_loaded,
      voices,
    });
  } catch (err: any) {
    // Return 200 with online: false so frontend health-check does not throw 503 error in console
    return NextResponse.json({
      online: false,
      status: "offline",
      message: "Voice clone server is currently offline on localhost:8001.",
      instructions: "Run 'voice-clone-server/start.bat' (or setup.bat if first time) to start the local AI engine.",
    });
  }
}

// POST /api/clone - Proxy voice cloning request to Python server
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get("text") as string;
    const speakerWav = formData.get("speaker_wav") as File | null;
    const voiceName = formData.get("voice_name") as string | null;
    const exaggeration = formData.get("exaggeration") as string || "0.5";
    const cfgWeight = formData.get("cfg_weight") as string || "0.5";
    const autoClean = formData.get("auto_clean") !== "false";

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Process stage directions, emotions, and bracketed pauses
    const processedText = autoClean ? parseScriptTags(text.trim()).cleanedText : text.trim();

    // Forward to Python server
    const pyFormData = new FormData();
    pyFormData.append("text", processedText);
    pyFormData.append("exaggeration", exaggeration);
    pyFormData.append("cfg_weight", cfgWeight);

    let targetEndpoint = `${PYTHON_SERVER_URL}/clone-voice`;

    if (speakerWav && speakerWav.size > 0) {
      pyFormData.append("speaker_wav", speakerWav, speakerWav.name);
    } else if (voiceName) {
      pyFormData.append("voice_name", voiceName);
      targetEndpoint = `${PYTHON_SERVER_URL}/clone-saved`;
    } else {
      return NextResponse.json(
        { error: "Either a reference audio file or a saved voice name is required" },
        { status: 400 }
      );
    }

    const abortSignal = AbortSignal.timeout(600_000); // 10‑minute timeout for long cloning jobs
const pyRes = await fetch(targetEndpoint, {
  method: "POST",
  body: pyFormData,
  signal: abortSignal,
});
      method: "POST",
      body: pyFormData,
    });

    if (!pyRes.ok) {
      const errorText = await pyRes.text();
      return NextResponse.json(
        { error: `Python Voice Server Error: ${errorText}` },
        { status: pyRes.status }
      );
    }

    const audioBuffer = await pyRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Content-Disposition": 'inline; filename="cloned_voice.wav"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Voice clone proxy error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to Voice Clone Server. Please ensure 'start.bat' is running on port 8001.",
        details: error?.message,
      },
      { status: 502 }
    );
  }
}
