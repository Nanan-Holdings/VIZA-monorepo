import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentSubscriptionForCurrentUser } from "@/lib/payments/commercial-records";
import { SubscriptionManagement } from "./subscription-management";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscriptionManagement");
  return { title: `${t("title")} | VIZA`, description: t("subtitle") };
}

export default async function SettingsSubscriptionPage() {
  const subscription = await getCurrentSubscriptionForCurrentUser();
  return <SubscriptionManagement initialSubscription={subscription} />;
}
