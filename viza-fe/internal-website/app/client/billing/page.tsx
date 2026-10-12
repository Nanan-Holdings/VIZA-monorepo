import { redirect } from "next/navigation";

/** Legacy compatibility route: billing has been retired. */
export default function ClientBillingPage() {
  redirect("/client/settings");
}
