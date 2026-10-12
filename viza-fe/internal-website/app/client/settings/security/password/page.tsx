import type { Metadata } from "next";
import { SettingsContent } from "../../settings-content";

export const metadata: Metadata = {
  title: "Password Security | VIZA",
  description: "Update your VIZA account password.",
};

export default function SettingsPasswordSecurityPage() {
  return <SettingsContent view="security-password" />;
}
