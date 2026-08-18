import { redirect } from "next/navigation";

/** Legacy medical-template route retained as a safe compatibility redirect. */
export default function LegacyPatientsPage() {
  redirect("/admin/users");
}
