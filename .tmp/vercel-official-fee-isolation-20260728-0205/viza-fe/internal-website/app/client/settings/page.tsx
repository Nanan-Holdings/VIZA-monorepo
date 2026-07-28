import type { Metadata } from "next";
import { SettingsContent } from "./settings-content";

export const metadata: Metadata = {
  title: "Settings | VIZA",
  description: "Manage your VIZA account settings and profile information.",
};

export default function SettingsPage() {
  return <SettingsContent />;
}
