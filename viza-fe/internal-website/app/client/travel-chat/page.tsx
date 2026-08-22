import { redirect } from "next/navigation";
import { TravelChatClient } from "./travel-chat-client";
import { getTravelUserSession } from "@/lib/travel/auth";
import { getLatestTravelApplicationIdForApplicant } from "@/lib/travel/travel-chat-application";

export const dynamic = "force-dynamic";

async function getApplicantId(): Promise<string | null> {
  return (await getTravelUserSession())?.userId ?? null;
}

export default async function TravelChatPage() {
  const applicantId = await getApplicantId();
  if (!applicantId) {
    redirect("/client/login");
  }

  const applicationId = await getLatestTravelApplicationIdForApplicant(applicantId);

  return <TravelChatClient applicationId={applicationId} />;
}
