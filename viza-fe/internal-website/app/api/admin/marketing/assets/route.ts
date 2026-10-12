import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { MARKETING_ASSET_BUCKET, validateMarketingAsset } from "@/lib/marketing/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { rehostMarketingCover } from "@/lib/marketing/cover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("admin", "staff");
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => null) as { url?: unknown } | null;
      if (typeof body?.url !== "string") return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
      const url = await rehostMarketingCover(body.url);
      if (!url) return NextResponse.json({ error: "Image could not be safely imported" }, { status: 400 });
      return NextResponse.json({ url, kind: "image" }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
    const valid = validateMarketingAsset({ kind, mimeType: file.type, size: file.size });
    const now = new Date();
    const path = `${valid.kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${actor.id}/${randomUUID()}.${valid.extension}`;
    const admin = createAdminClient();
    const uploaded = await admin.storage.from(MARKETING_ASSET_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const { data } = admin.storage.from(MARKETING_ASSET_BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, kind: valid.kind }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const unauthorized = /admin|staff|auth|session|permission/i.test(message);
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 400 });
  }
}
