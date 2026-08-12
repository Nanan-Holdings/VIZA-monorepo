import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { koreaEvidenceContentType, resolveKoreaEvidenceSource } from "./route-handler";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const rawPath = url.searchParams.get("path")?.trim();
  if (!rawPath) return NextResponse.json({ error: "Missing evidence path" }, { status: 400 });

  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("applications")
    .select("id, applicant_id, visa_type")
    .eq("id", id)
    .maybeSingle();
  if (error || !application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.visa_type !== "KR_C39_SHORT_TERM_VISIT") {
    return NextResponse.json({ error: "Unsupported application type" }, { status: 400 });
  }

  const impersonation = await getImpersonationSession();
  if (!impersonation) {
    const session = await getClientSessionWithFallback();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (session.userId !== application.applicant_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const evidence = resolveKoreaEvidenceSource(rawPath, id);
  if (!evidence) return NextResponse.json({ error: "Evidence path is not allowed" }, { status: 400 });

  try {
    const stored = evidence.kind === "storage"
      ? await admin.storage.from("submission-artifacts").download(evidence.path)
      : null;
    if (stored?.error || (evidence.kind === "storage" && !stored?.data)) {
      return NextResponse.json({ error: "Evidence file not found" }, { status: 404 });
    }
    const bytes = evidence.kind === "storage"
      ? new Uint8Array(await stored!.data!.arrayBuffer())
      : await fs.readFile(evidence.path);
    const contentType = koreaEvidenceContentType(evidence.path);
    const disposition = url.searchParams.get("download") === "1"
      ? `attachment; filename="${path.basename(evidence.path)}"`
      : "inline";
    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        "content-disposition": disposition,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Evidence file not found" }, { status: 404 });
  }
}
