import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial orders are retired. */
export default function AdminOrdersPage() {
  redirect("/admin/applications");
}
