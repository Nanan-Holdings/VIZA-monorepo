import { NextResponse } from "next/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getClientSession, getUserFromSupabaseSession } from "@/lib/client-session";

async function validSessionResponse({
  userId,
  sessionKind,
  sessionId,
}: {
  userId: string;
  sessionKind: "impersonation" | "supabase";
  sessionId: string;
}) {
  return NextResponse.json(
    {
      valid: true,
      userId,
      sessionKind,
      sessionId,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET() {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return validSessionResponse({
      userId: impersonation.userId,
      sessionKind: "impersonation",
      sessionId: impersonation.auditLogId,
    });
  }

  // Match proxy ordering: signed local sessions avoid an unnecessary
  // Supabase Auth round-trip and remain usable during a transient outage.
  const cookieSession = await getClientSession();
  if (cookieSession) {
    return validSessionResponse({
      userId: cookieSession.userId,
      sessionKind: "supabase",
      sessionId: `client_session:${cookieSession.userId}`,
    });
  }

  const session = await getUserFromSupabaseSession({ requestTimeoutMs: 1_500 });
  if (session) {
    return validSessionResponse({
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
  }, { headers: { "Cache-Control": "private, no-store" } });
}
