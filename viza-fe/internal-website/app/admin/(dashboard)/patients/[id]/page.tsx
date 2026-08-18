import { redirect } from "next/navigation";

export default async function LegacyPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/users/${id}`);
}
