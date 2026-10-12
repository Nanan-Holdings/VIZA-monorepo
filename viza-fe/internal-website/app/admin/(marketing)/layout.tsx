import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import AdminLayoutContent from "../admin-layout-content";
import "./marketing/marketing-portal.css";

/** Keep marketing available to staff without widening access to other admin routes. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "staff")) redirect("/admin/login");
  return (
    <AdminLayoutContent userName={user.name || user.email || "VIZA Editorial"} userRole={user.role}>
      {/* Every marketing screen renders inside the portal surface: the
          spreadsheet-first layout ported from the Volumet internal portal,
          scoped so it cannot reach the rest of /admin. */}
      <div className="mkt-root">{children}</div>
    </AdminLayoutContent>
  );
}
