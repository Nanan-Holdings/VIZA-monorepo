import "server-only";

import {
  getClientSession,
  getUserFromSupabaseSession,
} from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";

export type TravelUserSession = {
  userId: string;
  sessionKind: "impersonation" | "supabase" | "client_session";
};

/**
 * Resolve the same authenticated identities accepted by the client portal.
 * Travel routes must not accept fewer session types than /client itself.
 */
export async function getTravelUserSession(): Promise<TravelUserSession | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return {
      userId: impersonation.userId,
      sessionKind: "impersonation",
    };
  }

  // Match proxy.ts: a valid signed VIZA session does not need a Supabase
  // refresh request. This also keeps stale Supabase refresh cookies from
  // producing errors when the portal session is still valid.
  const clientSession = await getClientSession();
  if (clientSession) {
    return {
      userId: clientSession.userId,
      sessionKind: "client_session",
    };
  }

  const supabaseSession = await getUserFromSupabaseSession();
  if (supabaseSession) {
    return {
      userId: supabaseSession.userId,
      sessionKind: "supabase",
    };
  }

  return null;
}
