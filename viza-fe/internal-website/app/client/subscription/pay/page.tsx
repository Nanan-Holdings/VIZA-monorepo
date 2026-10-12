import { redirect } from "next/navigation";

/** Legacy compatibility route: subscription payment has been retired. */
export default function ClientSubscriptionPayPage() {
  redirect("/client/application");
}
