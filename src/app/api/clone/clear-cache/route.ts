import { NextResponse } from "next/server";
import { fetch as undiciFetch, Agent } from "undici";

export const runtime = "nodejs";

const agent = new Agent({
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
  connectTimeout: 5_000,
});

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

// POST /api/clone/clear-cache
export async function POST() {
  try {
    const pyRes = await undiciFetch(`${PYTHON_SERVER_URL}/clear-cache`, {
      method: "POST",
      dispatcher: agent,
      signal: AbortSignal.timeout(10_000),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json(
        { error: `Failed to clear cache: ${errText}` },
        { status: pyRes.status }
      );
    }

    const data = await pyRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Clear audio cache error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear audio cache" },
      { status: 500 }
    );
  }
}
