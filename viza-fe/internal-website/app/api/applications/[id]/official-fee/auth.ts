import type { NextRequest } from "next/server";
import { getClientSessionFromRequest } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ApplicantProfileAuthRow = {
  id: string;
  auth_user_id: string | null;
};

export type OfficialFeeApplicantAuthResult =
  | {
      ok: true;
      profileId: string;
      actorId: string;
      source: "client_session" | "supabase";
    }
  | {
      ok: false;
      error: string;
      status: 401 | 404 | 500;
    };

/**
 * Client pages accept either the signed VIZA client_session cookie or a
 * Supabase session. Official-fee endpoints must use the same policy so a
 * still-valid client session cannot render the payment UI and then receive a
 * contradictory 401 from the mutation endpoint.
 */
export async function resolveOfficialFeeApplicantAuth(
  request: NextRequest,
): Promise<OfficialFeeApplicantAuthResult> {
  const legacySession = await getClientSessionFromRequest(request);
  let supabaseAuthUserId: string | null = null;

  if (!legacySession) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    supabaseAuthUserId = user?.id ?? null;
  }

  if (!legacySession && !supabaseAuthUserId) {
    return { ok: false, error: "Not authenticated", status: 401 };
  }

  const admin = createAdminClient();
  const profileQuery = admin
    .from("applicant_profiles")
    .select("id, auth_user_id");
  const { data, error } = legacySession
    ? await profileQuery.eq("id", legacySession.userId).maybeSingle()
    : await profileQuery.eq("auth_user_id", supabaseAuthUserId!).maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const profile = data as ApplicantProfileAuthRow | null;
  if (!profile) {
    return { ok: false, error: "Applicant profile not found", status: 404 };
  }

  return {
    ok: true,
    profileId: profile.id,
    actorId: profile.auth_user_id ?? supabaseAuthUserId ?? legacySession!.userId,
    source: legacySession ? "client_session" : "supabase",
  };
}
