import * as fs from "node:fs/promises";
import * as path from "node:path";
import { NextResponse } from "next/server";
import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { createAdminClient } from "@/lib/supabase/admin";

function isAllowedEvidencePath(value: string): string | null {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const allowedRoots = [
    path.resolve(repoRoot, "output"),
    path.resolve(repoRoot, "viza-be", "submission-service", "output"),
  ];
  const candidate = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(repoRoot, "viza-be", "submission-service", value);
  return allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`))
    ? candidate
    : null;
}

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

  const evidencePath = isAllowedEvidencePath(rawPath);
  if (!evidencePath) return NextResponse.json({ error: "Evidence path is not allowed" }, { status: 400 });

  try {
    const bytes = await fs.readFile(evidencePath);
    const extension = path.extname(evidencePath).toLowerCase();
    const contentType = extension === ".pdf"
      ? "application/pdf"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : "image/png";
    const disposition = url.searchParams.get("download") === "1"
      ? `attachment; filename="${path.basename(evidencePath)}"`
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
