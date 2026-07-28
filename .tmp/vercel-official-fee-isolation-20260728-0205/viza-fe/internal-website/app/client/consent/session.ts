import { getUserFromSupabaseSession } from "@/lib/client-session";
import { getImpersonationSession } from "@/lib/impersonation-session";

export interface ConsentApplicantSession {
  applicantId: string;
  email: string;
  name: string | null;
  isImpersonation: boolean;
}

export async function getConsentApplicantSession(): Promise<ConsentApplicantSession | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return {
      applicantId: impersonation.userId,
      email: impersonation.userEmail,
      name: impersonation.userName,
      isImpersonation: true,
    };
  }

  const session = await getUserFromSupabaseSession();
  if (!session) return null;

  return {
    applicantId: session.userId,
    email: session.email,
    name: session.userName ?? null,
    isImpersonation: false,
  };
}
