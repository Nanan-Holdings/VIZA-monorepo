import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function portalBaseUrl(): URL | null {
  const value = process.env.NEXT_PUBLIC_PORTAL_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "127.0.0.1" || url.hostname === "localhost" ? url : null;
  } catch {
    return null;
  }
}

function sessionFromCookie(header: string | null): string | null {
  const value = header?.match(/(?:^|;\s*)viza_marketing_session=([A-Za-z0-9_-]{16,128})(?:;|$)/)?.[1];
  return value ?? null;
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) return new NextResponse("Not found", { status: 404 });
  const portal = portalBaseUrl();
  if (!portal) return new NextResponse("Not found", { status: 404 });

  const session = sessionFromCookie(request.headers.get("cookie")) ?? randomUUID().replaceAll("-", "");
  const endpoint = new URL(`/api/marketing/short-link/${encodeURIComponent(code)}`, portal);
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      headers: {
        cookie: `viza_marketing_session=${session}`,
        referer: request.headers.get("referer") ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-vercel-ip-country": request.headers.get("x-vercel-ip-country") ?? "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!upstream.ok) return new NextResponse("Not found", { status: 404 });

  const body = await upstream.json().catch(() => null) as { destinationUrl?: unknown } | null;
  if (typeof body?.destinationUrl !== "string") return new NextResponse("Not found", { status: 404 });
  let destination: URL;
  try { destination = new URL(body.destinationUrl); } catch { return new NextResponse("Not found", { status: 404 }); }
  if (destination.protocol !== "https:") return new NextResponse("Not found", { status: 404 });

  const response = NextResponse.redirect(destination, 307);
  response.cookies.set("viza_marketing_session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
