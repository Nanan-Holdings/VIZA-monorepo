import { NextResponse } from "next/server";
import { getInboundEmailAttachment } from "@/app/actions/inbox";

export const runtime = "nodejs";

/**
 * Streams one MIME part of an inbound message (INBOX-008). The server action
 * re-checks alias ownership before touching R2, then the raw `.eml` is parsed
 * on demand — parts are never persisted, only re-derived.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  try {
    const { id, index } = await params;
    const partIndex = Number.parseInt(index, 10);
    const part = await getInboundEmailAttachment(id, partIndex);
    if (!part) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    const filename = part.filename.replace(/["\r\n]/g, "");
    const body = new Uint8Array(part.data);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": part.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
