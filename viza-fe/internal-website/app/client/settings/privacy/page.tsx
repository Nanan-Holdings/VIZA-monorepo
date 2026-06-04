import type { Metadata } from "next";
import { SettingsContent } from "../settings-content";

export const metadata: Metadata = {
  title: "Privacy | VIZA",
  description: "Manage privacy and data-rights requests.",
};

export default function SettingsPrivacyPage() {
  return <SettingsContent view="privacy" />;
}
