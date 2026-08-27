import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const REVEAL_TIMEOUT_MS = 12_000;

function noStoreHeaders() {
  return {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing application id" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: noStoreHeaders() },
    );
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVEAL_TIMEOUT_MS);
  try {
    const upstream = await fetch(
      `${AGENT_BACKEND_URL}/api/applications/${encodeURIComponent(applicationId)}/jp-vjw/account/reveal`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const body = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: typeof body?.error === "string" ? body.error : "Could not reveal the Visit Japan Web account" },
        { status: upstream.status, headers: noStoreHeaders() },
      );
    }
    if (
      typeof body?.email !== "string"
      || typeof body.password !== "string"
      || typeof body.portalUrl !== "string"
      || typeof body.revealedAt !== "string"
    ) {
      return NextResponse.json(
        { error: "Visit Japan Web account response was incomplete" },
        { status: 502, headers: noStoreHeaders() },
      );
    }
    return NextResponse.json(
      {
        email: body.email,
        password: body.password,
        portalUrl: body.portalUrl,
        revealedAt: body.revealedAt,
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    return NextResponse.json(
      { error: "Visit Japan Web account service is unavailable" },
      { status: 503, headers: noStoreHeaders() },
    );
  } finally {
    clearTimeout(timeout);
  }
}
