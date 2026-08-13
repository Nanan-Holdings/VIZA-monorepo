import { NextRequest } from "next/server";

const LIVETALKING_BASE_URL = process.env.LIVETALKING_BASE_URL?.replace(/\/$/, "");
const POST_ACTIONS = new Set(["offer", "human", "interrupt_talk", "is_speaking"]);

function unavailable() {
  return Response.json({ error: "LiveTalking is not configured" }, { status: 503 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (!LIVETALKING_BASE_URL) return unavailable();
  if (!POST_ACTIONS.has(action)) return Response.json({ error: "Unsupported action" }, { status: 404 });

  try {
    const body = await request.text();
    const upstream = await fetch(`${LIVETALKING_BASE_URL}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return unavailable();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (!LIVETALKING_BASE_URL) return unavailable();
  if (action !== "sse") return Response.json({ error: "Unsupported action" }, { status: 404 });

  const sessionid = request.nextUrl.searchParams.get("sessionid");
  if (!sessionid) return Response.json({ error: "Missing sessionid" }, { status: 400 });
  try {
    const upstream = await fetch(`${LIVETALKING_BASE_URL}/sse?sessionid=${encodeURIComponent(sessionid)}`, {
      cache: "no-store",
      headers: { Accept: "text/event-stream" },
    });
    if (!upstream.ok || !upstream.body) return unavailable();
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return unavailable();
  }
}
