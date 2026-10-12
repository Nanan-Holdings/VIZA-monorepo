import type { Metadata } from "next";
import { TravelMemorySettings } from "./travel-memory-settings";

export const metadata: Metadata = {
  title: "Travel preference memory | VIZA",
};

export default function TravelMemorySettingsPage() {
  return <TravelMemorySettings />;
}
