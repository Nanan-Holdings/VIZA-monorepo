import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import AdminLayoutContent from "../admin-layout-content";

export default async function CustomerServiceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !["admin", "staff", "customer_service"].includes(user.role)) redirect("/admin/login");

  return (
    <AdminLayoutContent userName={user.name || user.email || "VIZA Support"} userRole={user.role}>
      {children}
    </AdminLayoutContent>
  );
}
