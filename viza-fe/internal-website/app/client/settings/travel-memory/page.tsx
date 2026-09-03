import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TravelMemorySettings } from "./travel-memory-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.travelMemory");
  return { title: `${t("title")} | VIZA`, description: t("description") };
}

export default function TravelMemorySettingsPage() {
  return <TravelMemorySettings />;
}
