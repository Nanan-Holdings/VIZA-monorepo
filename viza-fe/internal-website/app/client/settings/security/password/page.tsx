import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsContent } from "../../settings-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.security");
  return { title: `${t("passwordTitle")} | VIZA`, description: t("passwordDescription") };
}

export default function SettingsPasswordSecurityPage() {
  return <SettingsContent view="security-password" />;
}
