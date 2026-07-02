import { FranceAppointmentAssistant } from "@/components/client/france-appointment/france-appointment-assistant";

export const dynamic = "force-dynamic";

export default async function FranceAppointmentPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <FranceAppointmentAssistant applicationId={applicationId} />;
}
