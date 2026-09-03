import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "../settings-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.privacy");
  return { title: `${t("title")} | VIZA`, description: t("intro") };
}

export default function SettingsPrivacyPage() {
  return <SettingsContent view="privacy" />;
}
