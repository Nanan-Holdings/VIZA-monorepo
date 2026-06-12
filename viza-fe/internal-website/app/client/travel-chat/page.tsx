import { redirect } from "next/navigation";
import { TravelChatClient } from "./travel-chat-client";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";
import { getLatestTravelApplicationIdForApplicant } from "@/lib/travel/travel-chat-application";

export const dynamic = "force-dynamic";

async function getApplicantId(): Promise<string | null> {
  const impersonation = await getImpersonationSession();
  if (impersonation) {
    return impersonation.userId;
  }

  const session = await getUserFromSupabaseSession();
  if (session) {
    return session.userId;
  }

  return null;
}

export default async function TravelChatPage() {
  const applicantId = await getApplicantId();
  if (!applicantId) {
    redirect("/client/login");
  }

  const applicationId = await getLatestTravelApplicationIdForApplicant(applicantId);

  return <TravelChatClient applicationId={applicationId} />;
}
