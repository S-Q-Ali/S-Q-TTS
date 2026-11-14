import { NextRequest, NextResponse } from "next/server";
import { fetch as undiciFetch, Agent } from "undici";

export const runtime = "nodejs";

const agent = new Agent({
  headersTimeout: 15_000,
  bodyTimeout: 15_000,
  connectTimeout: 5_000,
});

const PYTHON_SERVER_URL = process.env.VOICE_CLONE_SERVER_URL || "http://127.0.0.1:8001";

// DELETE /api/clone/delete?name=VoiceName
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    const encoded = encodeURIComponent(name.trim());
    const pyRes = await undiciFetch(`${PYTHON_SERVER_URL}/voices/${encoded}`, {
      method: "DELETE",
      dispatcher: agent,
      signal: AbortSignal.timeout(10_000),
    });

    if (!pyRes.ok) {
      const errText = await pyRes.text();
      return NextResponse.json(
        { error: `Failed to delete: ${errText}` },
        { status: pyRes.status }
      );
    }

    const data = await pyRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Delete voice error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete voice profile" },
      { status: 500 }
    );
  }
}
