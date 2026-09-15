import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial refunds are retired. */
export default function AdminRefundsPage() {
  redirect("/admin/applications");
}
