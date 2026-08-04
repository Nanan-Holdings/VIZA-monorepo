import { NextResponse } from "next/server";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getClientSession, getUserFromSupabaseSession } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

const BOOTSTRAP_DB_TIMEOUT_MS = 1_500;

function isSchemaNotReadyError(error: { code?: string } | null): boolean {
  return Boolean(
    error &&
      ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")
  );
}

async function ensurePendingFormRequest(userId: string): Promise<string | null> {
  const adminClient = createAdminClient({ requestTimeoutMs: BOOTSTRAP_DB_TIMEOUT_MS });
  // The RPC is service-role-only and atomically creates at most one pending
  // first-login request. Cast until generated types include migration 0131.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any).rpc(
    "ensure_first_login_form_request",
    { p_user_id: userId }
  );

  if (error) {
    // Keep onboarding optional during a rolling deploy where code can reach a
    // database that has not received the migration yet.
    if (!isSchemaNotReadyError(error)) {
      console.error("Unable to provision first-login form request", {
        code: error.code,
      });
    }
    return null;
  }

  return typeof data === "string" ? data : null;
}

async function validSessionResponse({
  userId,
  sessionKind,
  sessionId,
}: {
  userId: string;
  sessionKind: "impersonation" | "supabase";
  sessionId: string;
}) {
  let pendingFormRequestId: string | null = null;
  try {
    pendingFormRequestId = await ensurePendingFormRequest(userId);
  } catch (error) {
    // Session validity is the critical path. Optional onboarding must never
    // turn a healthy authenticated page into an infinite loader.
    console.error("Optional onboarding bootstrap timed out", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }

  return NextResponse.json(
    {
      valid: true,
      userId,
      sessionKind,
      sessionId,
      pendingFormRequestId,
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
    pendingFormRequestId: null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
