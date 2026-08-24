import { redirect } from "next/navigation";
import {
  getClientStatusData,
} from "./status-data";
import {
  normalizeCountryParam,
} from "./application-list-items";
import { buildApplicationLongFormHref } from "@/lib/client/recent-application-form";

type SearchParams = Promise<{
  applicationId?: string | string[];
  packageId?: string | string[];
  country?: string | string[];
  view?: string | string[];
}>;

export const dynamic = "force-dynamic";

function getParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ClientStatusPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const data = await getClientStatusData();
  if (!data.authenticated) redirect("/client/login");

  const selectedApplicationId = getParam(params.applicationId);
  const selectedPackageId = getParam(params.packageId);
  const selectedCountry = normalizeCountryParam(getParam(params.country));

  if (selectedApplicationId) {
    const application = data.detailApplications.find(
      (candidate) => candidate.id === selectedApplicationId
    );
    if (application?.id) {
      redirect(buildApplicationLongFormHref({
        applicationId: application.id,
        country: application.country,
        visaType: application.visaType,
        step: "status",
      }));
    }
  }

  if (selectedPackageId) {
    const application = data.detailApplications.find(
      (candidate) => candidate.packageId === selectedPackageId
    );
    if (application?.id) {
      redirect(buildApplicationLongFormHref({
        applicationId: application.id,
        country: application.country,
        visaType: application.visaType,
        step: "status",
      }));
    }
  }

  redirect(selectedCountry ? "/client/application#my-applications" : "/client/application");
}
