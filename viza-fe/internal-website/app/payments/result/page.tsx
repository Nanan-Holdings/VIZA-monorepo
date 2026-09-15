import { redirect } from "next/navigation";

/** Legacy compatibility route: payment results have been retired. */
export default function PaymentResultPage() {
  redirect("/client/status");
}
