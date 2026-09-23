import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import AdminLayoutContent from "../admin-layout-content";

/** Keep marketing available to staff without widening access to other admin routes. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "staff")) redirect("/admin/login");
  return <AdminLayoutContent userName={user.name || user.email || "VIZA Editorial"} userRole={user.role}>{children}</AdminLayoutContent>;
}
