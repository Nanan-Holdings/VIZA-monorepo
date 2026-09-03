import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "../../settings-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.security");
  return { title: `${t("emailTitle")} | VIZA`, description: t("emailDescription") };
}

export default function SettingsEmailSecurityPage() {
  return <SettingsContent view="security-email" />;
}
