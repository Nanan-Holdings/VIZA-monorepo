import { NextResponse } from "next/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";

export async function GET() {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return NextResponse.json({
      valid: true,
      userId: impersonation.userId,
      sessionKind: "impersonation",
      sessionId: impersonation.auditLogId,
    });
  }

  const session = await getUserFromSupabaseSession();
  if (session) {
    return NextResponse.json({
      valid: true,
      userId: session.userId,
      sessionKind: "supabase",
      sessionId: `supabase:${session.userId}`,
    });
  }

  return NextResponse.json({
    valid: false,
    userId: null,
    sessionKind: null,
    sessionId: null,
  });
}
