import { redirect } from "next/navigation";

/** Legacy compatibility route: order receipts have been retired. */
export default function ClientOrderPage() {
  redirect("/client/status");
}
