import type { Metadata } from "next";
import { getCurrentSubscriptionForCurrentUser } from "@/lib/payments/commercial-records";
import { SubscriptionManagement } from "./subscription-management";

export const metadata: Metadata = {
  title: "Subscription Management | VIZA",
  description: "Manage your VIZA monthly subscription plan.",
};

export default async function SettingsSubscriptionPage() {
  const subscription = await getCurrentSubscriptionForCurrentUser();
  return <SubscriptionManagement initialSubscription={subscription} />;
}
