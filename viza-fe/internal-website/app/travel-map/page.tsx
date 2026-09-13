import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { TravelMapFrameClient } from "./travel-map-frame-client";

export default async function TravelMapPage({ searchParams }: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale } = await searchParams;
  return <TravelMapFrameClient locale={normalizeInterfaceLocale(locale)} />;
}
