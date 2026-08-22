import { redirect } from "next/navigation";
import { buildKoreaArrivalCardIntegratedFormHref } from "@/features/kr-arrival-card/routes";

export default async function SouthKoreaArrivalCardPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string | string[] }>;
}) {
  const params = await searchParams;
  const applicationId = Array.isArray(params.applicationId)
    ? params.applicationId[0]
    : params.applicationId;
  redirect(buildKoreaArrivalCardIntegratedFormHref(applicationId));
}
