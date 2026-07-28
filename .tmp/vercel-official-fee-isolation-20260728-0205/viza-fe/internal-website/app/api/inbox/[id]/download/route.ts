import { NextResponse } from "next/server";
import { getInboundEmailDownloadUrl } from "@/app/actions/inbox";

/**
 * Redirect handler for INBOX-006 attachment downloads. Resolves the
 * R2 presigned URL via the server action (which is RLS-aware, so an
 * applicant can only fetch their own message) and 302s the client to
 * the time-limited URL.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { url } = await getInboundEmailDownloadUrl(id);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
