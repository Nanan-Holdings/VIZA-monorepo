import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "../settings-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.travelers");
  return { title: `${t("title")} | VIZA`, description: t("description") };
}

export default function SettingsTravelersPage() {
  return <SettingsContent view="travelers" />;
}
