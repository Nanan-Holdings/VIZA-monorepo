/**
 * POST /api/passport-scan/extract
 *
 * Body: { applicationId: string, storagePath: string, mediaType?: string }
 *
 * 1. Verifies the caller is an authenticated client.
 * 2. Confirms the storagePath belongs to one of that applicant's documents.
 * 3. Downloads the image from Supabase storage (bucket `application-documents`)
 *    via the admin client.
 * 4. Forwards the base64 image to the agent-backend OCR route, which calls
 *    Claude vision and returns structured fields.
 * 5. Relays the extraction back to the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

const AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const STORAGE_BUCKET = "application-documents";

export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromSupabaseSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { applicationId, storagePath, mediaType } = (await request.json()) as {
      applicationId?: string;
      storagePath?: string;
      mediaType?: string;
    };

    if (!applicationId || typeof applicationId !== "string") {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    }

    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json({ error: "storagePath required" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: application } = await adminClient
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("applicant_id", session.userId)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: document } = await adminClient
      .from("application_documents")
      .select("id")
      .eq("application_id", applicationId)
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (!document) {
      return NextResponse.json({ error: "document not found" }, { status: 404 });
    }

    const { data: blob, error: downloadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      return NextResponse.json(
        { error: "image not found", detail: downloadError?.message },
        { status: 404 },
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const detectedMedia =
      mediaType ||
      (blob.type && ["image/jpeg", "image/png", "image/webp"].includes(blob.type)
        ? blob.type
        : "image/jpeg");

    const upstream = await fetch(`${AGENT_BACKEND_URL}/api/passport-scan/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType: detectedMedia }),
    });

    const payload = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "extraction failed", detail: payload },
        { status: upstream.status },
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
