import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial pricing is retired. */
export default function AdminPricingPage() {
  redirect("/admin/packages");
}
