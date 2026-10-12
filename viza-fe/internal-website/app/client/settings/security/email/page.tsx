import type { Metadata } from "next";
import { SettingsContent } from "../../settings-content";

export const metadata: Metadata = {
  title: "Email Security | VIZA",
  description: "Update your VIZA account email.",
};

export default function SettingsEmailSecurityPage() {
  return <SettingsContent view="security-email" />;
}
