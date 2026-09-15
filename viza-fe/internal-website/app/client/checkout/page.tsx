import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial checkout has been retired. */
export default function ClientCheckoutPage() {
  redirect("/client/application");
}
