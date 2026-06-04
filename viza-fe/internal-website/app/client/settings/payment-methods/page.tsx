import type { Metadata } from "next";
import { SettingsContent } from "../settings-content";

export const metadata: Metadata = {
  title: "Payment Methods | VIZA",
  description: "Manage saved payment methods for your VIZA account.",
};

export default function SettingsPaymentMethodsPage() {
  return <SettingsContent view="payment-methods" />;
}
