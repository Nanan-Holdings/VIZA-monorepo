import type { Metadata } from "next";
import { SettingsContent } from "../settings-content";

export const metadata: Metadata = {
  title: "Points Center | VIZA",
  description: "View and redeem VIZA points.",
};

export default function SettingsPointsPage() {
  return <SettingsContent view="points" />;
}
