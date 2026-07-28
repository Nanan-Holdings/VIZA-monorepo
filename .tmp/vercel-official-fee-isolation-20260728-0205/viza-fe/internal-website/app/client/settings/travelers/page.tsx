import type { Metadata } from "next";
import { SettingsContent } from "../settings-content";

export const metadata: Metadata = {
  title: "Frequent Travelers | VIZA",
  description: "Manage reusable traveler profiles.",
};

export default function SettingsTravelersPage() {
  return <SettingsContent view="travelers" />;
}
