import { notFound } from "next/navigation";
import { DestinationRegionPageClient } from "@/components/client/home/DestinationRegionPageClient";
import {
  getVisaDestinationRegionGroup,
  getVisaDestinationsForRegion,
  VISA_DESTINATION_REGION_GROUPS,
} from "@/lib/visa-destinations";

type PageProps = {
  params: Promise<{ region: string }>;
};

export function generateStaticParams() {
  return VISA_DESTINATION_REGION_GROUPS
    .filter((region) => region.id !== "schengen")
    .map((region) => ({ region: region.id }));
}

export default async function DestinationRegionPage({ params }: PageProps) {
  const { region: regionId } = await params;
  const region = getVisaDestinationRegionGroup(regionId);
  if (!region || region.id === "schengen") notFound();

  return (
    <DestinationRegionPageClient
      region={region}
      destinations={getVisaDestinationsForRegion(region.id)}
    />
  );
}
