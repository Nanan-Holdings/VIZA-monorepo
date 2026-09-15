import { redirect } from "next/navigation";

/** Legacy compatibility route: paid region selection has been retired. */
export default function SubscriptionRegionPage() {
  redirect("/client/application");
}
