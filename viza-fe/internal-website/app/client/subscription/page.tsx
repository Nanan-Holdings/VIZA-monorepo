import { redirect } from "next/navigation";

/** Legacy compatibility route: subscriptions have been retired. */
export default function ClientSubscriptionPage() {
  redirect("/client/settings");
}
