import { getClientSessionWithFallback } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";

/** Applicant profile id for `/api/applications/*` ownership checks. */
export async function getApplicationApiApplicantProfileId(): Promise<string | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) return impersonation.userId;

  const session = await getClientSessionWithFallback();
  return session?.userId ?? null;
}
