import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "./settings-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("title")} | VIZA`, description: t("subtitle") };
}

export default function SettingsPage() {
  return <SettingsContent />;
}
