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

  const supabaseSession = await getUserFromSupabaseSession();
  if (supabaseSession) {
    return {
      userId: supabaseSession.userId,
      sessionKind: "supabase",
    };
  }

  const clientSession = await getClientSession();
  if (clientSession) {
    return {
      userId: clientSession.userId,
      sessionKind: "client_session",
    };
  }

  return null;
}
