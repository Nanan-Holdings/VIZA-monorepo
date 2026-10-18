import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { MARKETING_ASSET_BUCKET, marketingAssetPath, validateMarketingAsset } from "@/lib/marketing/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { rehostMarketingCover } from "@/lib/marketing/cover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("admin", "staff");
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => null) as { url?: unknown; kind?: unknown; mimeType?: unknown; size?: unknown } | null;
      /* A short is 5 to 15 MB, past the 4.5 MB a Vercel function will accept
         as a request body, so the browser uploads it straight to storage.
         This hands out a one-object signed upload URL after the same
         allowlist check a direct upload gets. */
      if (body?.kind === "video") {
        const valid = validateMarketingAsset({ kind: "video", mimeType: String(body.mimeType ?? ""), size: Number(body.size) });
        const path = marketingAssetPath(valid.kind, actor.id, randomUUID(), valid.extension);
        const admin = createAdminClient();
        const signed = await admin.storage.from(MARKETING_ASSET_BUCKET).createSignedUploadUrl(path);
        if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Unable to prepare the upload");
        const { data } = admin.storage.from(MARKETING_ASSET_BUCKET).getPublicUrl(path);
        return NextResponse.json(
          { kind: valid.kind, bucket: MARKETING_ASSET_BUCKET, path, token: signed.data.token, url: data.publicUrl },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
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
    if (valid.kind === "video") return NextResponse.json({ error: "Videos upload through a signed URL; request one with JSON" }, { status: 400 });
    const path = marketingAssetPath(valid.kind, actor.id, randomUUID(), valid.extension);
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
