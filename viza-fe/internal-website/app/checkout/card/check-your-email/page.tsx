import { redirect } from "next/navigation";

/** Legacy compatibility route: guest payment confirmation has been retired. */
export default function CardCheckoutCheckEmailPage() {
  redirect("/client/login");
}
