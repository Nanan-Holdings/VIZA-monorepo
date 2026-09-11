import { after, NextResponse } from "next/server";
import {
  createClientSession,
  getClientSessionReadResult,
  type ClientSessionReadResult,
} from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { cacheContinuityIdentity } from "@/lib/resilience/continuity-auth";
import {
  recordPortalReadOutcome,
  tracePortalReadStage,
  withPortalReadTrace,
} from "@/lib/observability/portal-read";

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
      status: "authenticated",
      userId,
      sessionKind,
      sessionId,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function unauthenticatedSessionResponse() {
  return NextResponse.json(
    {
      valid: false,
      status: "unauthenticated",
      userId: null,
      sessionKind: null,
      sessionId: null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function unavailableSessionResponse() {
  return NextResponse.json(
    {
      valid: false,
      status: "unavailable",
      code: "provider_unavailable",
      userId: null,
      sessionKind: null,
      sessionId: null,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": "3",
      },
    },
  );
}

function recordSessionReadOutcome(result: ClientSessionReadResult): void {
  if (result.status === "authenticated") {
    recordPortalReadOutcome("ok");
  } else if (result.status === "unauthenticated") {
    recordPortalReadOutcome("unauthenticated");
  } else {
    recordPortalReadOutcome(result.reason === "cancelled" ? "cancelled" : "unavailable");
  }
}

export async function GET(request: Request) {
  return withPortalReadTrace("session", async () => {
    const impersonation = await tracePortalReadStage("auth", () => getImpersonationSession());
    if (impersonation) {
      recordPortalReadOutcome("ok");
      return validSessionResponse({
        userId: impersonation.userId,
        sessionKind: "impersonation",
        sessionId: impersonation.auditLogId,
      });
    }

    const result = await tracePortalReadStage("auth", () =>
      getClientSessionReadResult({
        requestTimeoutMs: 1_500,
        retryDelaysMs: [],
        requestSignal: request.signal,
      }),
    );
    recordSessionReadOutcome(result);

    if (result.status === "unauthenticated") return unauthenticatedSessionResponse();
    if (result.status === "unavailable") return unavailableSessionResponse();

    if (result.source === "supabase") {
      try {
        // A successful fallback already resolved the profile and Auth UUID.
        // Sign the existing identity once; ordinary cookie probes stay local.
        await createClientSession(
          result.session.userId,
          result.session.email,
          result.session.authUserId,
        );
      } catch {
        recordPortalReadOutcome("unavailable");
        return unavailableSessionResponse();
      }

      // Keep recovery continuity on the bootstrap path only. A valid local
      // cookie must not trigger a gateway write on every page mount. The
      // optional write must not extend the authentication response deadline.
      after(async () => {
        await cacheContinuityIdentity(result.session).catch(() => undefined);
      });
    }

    return validSessionResponse({
      userId: result.session.userId,
      sessionKind: "supabase",
      sessionId: result.source === "cookie"
        ? `client_session:${result.session.userId}`
        : `supabase:${result.session.userId}`,
    });
  });
}
