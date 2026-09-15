import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial billing is retired. */
export default function AdminBillingPage() {
  redirect("/admin/applications");
}
