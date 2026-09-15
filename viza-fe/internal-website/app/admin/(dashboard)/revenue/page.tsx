import { redirect } from "next/navigation";

/** Legacy compatibility route: commercial revenue is retired. */
export default function AdminRevenuePage() {
  redirect("/admin/applications");
}
