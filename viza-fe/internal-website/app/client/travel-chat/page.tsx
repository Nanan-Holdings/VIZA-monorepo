import { redirect } from "next/navigation";
import { TravelChatClient } from "./travel-chat-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/impersonation-session";
import { getUserFromSupabaseSession } from "@/lib/client-session";

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

  const adminClient = createAdminClient();
  const { data: application } = await adminClient
    .from("applications")
    .select("id, status")
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isCompleted = application?.status === "submitted" || application?.status === "approved";
  if (!isCompleted || !application?.id) {
    redirect("/client/application");
  }

  return <TravelChatClient applicationId={application.id} />;
}
