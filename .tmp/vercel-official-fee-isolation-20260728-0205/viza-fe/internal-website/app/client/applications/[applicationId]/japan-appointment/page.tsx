import { JapanVfsAppointmentAssistant } from "@/components/client/japan-appointment/JapanVfsAppointmentAssistant";

export const dynamic = "force-dynamic";

export default async function JapanAppointmentPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <JapanVfsAppointmentAssistant applicationId={applicationId} />;
}
