/**
 * POST /api/passport-scan/extract
 *
 * Public, unauthenticated proxy that forwards a passport image from the
 * marketing-site apply flow to the agent-backend OCR endpoint (Claude vision).
 *
 * Marketing pages have zero user state by design (see CLAUDE.md), so this
 * route does not persist the image — it base64-encodes the upload in-memory
 * and relays the structured extraction result back to the browser.
 *
 * Body: multipart/form-data with `file` (image/jpeg | image/png | image/webp).
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ??
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ??
  "http://localhost:3002";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Field 'file' is required" },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "Max 10MB" },
      { status: 413 },
    );
  }

  const mediaType = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: "unsupported_media", message: "Use JPG, PNG, or WebP" },
      { status: 415 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT_BACKEND_URL}/api/passport-scan/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const payload = (await upstream.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!upstream.ok || !payload) {
    return NextResponse.json(
      { error: "extraction_failed", detail: payload },
      { status: upstream.status || 502 },
    );
  }

  return NextResponse.json(payload);
}
