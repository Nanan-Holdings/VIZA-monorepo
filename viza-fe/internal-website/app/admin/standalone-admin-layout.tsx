import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import AdminLayoutContent from "./admin-layout-content";

/**
 * Keeps legacy top-level admin routes inside the authenticated admin shell.
 * Route groups can be consolidated later without changing public URLs.
 */
export default async function StandaloneAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  return (
    <AdminLayoutContent userName={user.name || user.email || "VIZA Admin"} userRole={user.role}>
      {children}
    </AdminLayoutContent>
  );
}
