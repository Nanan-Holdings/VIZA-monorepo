import { KoreaAppointmentAssistant } from "@/components/client/korea-appointment/KoreaAppointmentAssistant";

export default async function KoreaAppointmentPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <KoreaAppointmentAssistant applicationId={applicationId} />;
}
