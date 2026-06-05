import { USAppointmentAssistant } from "@/components/client/us-appointment/us-appointment-assistant";

export const dynamic = "force-dynamic";

export default async function USAppointmentPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <USAppointmentAssistant applicationId={applicationId} />;
}
