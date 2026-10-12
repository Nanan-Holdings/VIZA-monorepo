import { redirect } from "next/navigation";

/** Legacy compatibility route: guest card checkout has been retired. */
export default function CardCheckoutPage() {
  redirect("/client/application");
}
