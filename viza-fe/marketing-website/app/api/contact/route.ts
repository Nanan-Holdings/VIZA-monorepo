import { NextResponse } from "next/server";
import { portalUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Contact-form submit — thin server-side proxy to the portal's
 * `/api/contact`, which validates and emails the enquiry to ops.
 * Mirrors the passport-scan proxy pattern: the marketing site keeps
 * zero backend/auth dependencies and never talks to Resend directly.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const res = await fetch(portalUrl("/api/contact"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Contact submits are small; fail fast rather than hang the UI.
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({ ok: false }))) as object;
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    console.error("[contact] portal proxy failed:", err);
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }
}
