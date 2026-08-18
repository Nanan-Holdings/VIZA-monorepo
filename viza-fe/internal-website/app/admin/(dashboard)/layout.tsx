import { getCurrentUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import AdminLayoutContent from "../admin-layout-content";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayoutContent
      userName={user.name || user.email || "VIZA Admin"}
      userRole={user.role}
    >
      {children}
    </AdminLayoutContent>
  );
}
