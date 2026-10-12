import { redirect } from "next/navigation";

/** Legacy compatibility route: payment checkout has been retired. */
export default function PaymentCheckoutPage() {
  redirect("/client/application");
}
