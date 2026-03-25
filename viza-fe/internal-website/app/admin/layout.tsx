import { getCurrentUser } from "@/lib/rbac";
import { redirect } from "next/navigation";
import AdminLayoutContent from "./admin-layout-content";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/login");
  }

  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}
