import { KoreaAppointmentRules } from "@/components/client/korea-appointment/KoreaAppointmentRules";

export default async function KoreaAppointmentRulesPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <KoreaAppointmentRules applicationId={applicationId} />;
}
