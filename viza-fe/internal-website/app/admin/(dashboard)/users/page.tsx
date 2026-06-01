import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { normalizeInterfaceLocale, type InterfaceLocale } from "@/lib/i18n/locale";

interface UserRow {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  nationality: string | null;
  created_at: string | null;
}

interface VisaPackageJoin {
  name: string;
  country: string;
  visa_type: string;
}

interface UserPackageRow {
  auth_user_id: string;
  status: string;
  visa_packages: VisaPackageJoin[] | VisaPackageJoin | null;
}

interface ApplicationRow {
  applicant_id: string;
  status: string;
}

const COPY = {
  en: {
    title: "User Accounts",
    subtitle: "All registered users and their active visa packages",
    headings: {
      name: "Name",
      email: "Email",
      nationality: "Nationality",
      activePackage: "Active package",
      applicationStatus: "Application status",
      joined: "Joined",
    },
    none: "None",
    noUsers: "No users found",
  },
  zh: {
    title: "用户账户",
    subtitle: "所有注册用户及其启用中的签证套餐",
    headings: {
      name: "姓名",
      email: "邮箱",
      nationality: "国籍",
      activePackage: "启用套餐",
      applicationStatus: "申请状态",
      joined: "加入时间",
    },
    none: "无",
    noUsers: "暂无用户",
  },
} as const;

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];

  const adminClient = createAdminClient();

  // Fetch applicant profiles
  const { data: profiles } = await adminClient
    .from("applicant_profiles")
    .select("id, auth_user_id, full_name, email, nationality, created_at")
    .order("created_at", { ascending: false });

  // Fetch active user packages with visa package details
  const { data: packages } = await adminClient
    .from("user_packages")
    .select("auth_user_id, status, visa_packages(name, country, visa_type)")
    .eq("status", "active");

  // Fetch latest application per applicant
  const { data: applications } = await adminClient
    .from("applications")
    .select("applicant_id, status")
    .order("created_at", { ascending: false });

  // Build lookup maps
  const packageMap = new Map<string, UserPackageRow>();
  for (const pkg of (packages ?? []) as UserPackageRow[]) {
    if (pkg.auth_user_id) packageMap.set(pkg.auth_user_id, pkg);
  }

  const appMap = new Map<string, string>();
  for (const app of (applications ?? []) as ApplicationRow[]) {
    if (!appMap.has(app.applicant_id)) appMap.set(app.applicant_id, app.status);
  }

  const rows = (profiles ?? []) as UserRow[];

  return (
    <div className="w-full p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
        <p className="text-sm text-[#6b6b6b] mt-1">
          {copy.subtitle}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafafa]">
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.name}</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.email}</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.nationality}</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.activePackage}</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.applicationStatus}</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b6b6b]">{copy.headings.joined}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pkg = row.auth_user_id ? packageMap.get(row.auth_user_id) : null;
                const appStatus = appMap.get(row.id);

                return (
                  <tr key={row.id} className="border-b hover:bg-[#fafafa] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${row.id}`}
                        className="text-brand-500 hover:underline font-medium"
                      >
                        {row.full_name || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{row.email || "—"}</td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{row.nationality || "—"}</td>
                    <td className="px-4 py-3">
                      {pkg?.visa_packages ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-500 border border-brand-200">
                          {Array.isArray(pkg.visa_packages) ? pkg.visa_packages[0]?.name : pkg.visa_packages.name}
                        </span>
                      ) : (
                        <span className="text-[#9ca3af]">{copy.none}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {appStatus ? (
                        <StatusBadge status={appStatus} locale={locale} />
                      ) : (
                        <span className="text-[#9ca3af]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#6b6b6b]">
                      {row.created_at
                        ? formatDate(row.created_at, locale)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#9ca3af]">
                    {copy.noUsers}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, locale }: { status: string; locale: InterfaceLocale }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-50 text-blue-700",
    processing: "bg-yellow-50 text-yellow-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    completed: "bg-green-50 text-green-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        colors[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {localizeStatus(status, locale)}
    </span>
  );
}

function formatDate(value: string, locale: InterfaceLocale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-SG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function localizeStatus(status: string, locale: InterfaceLocale) {
  if (locale === "en") return status.replaceAll("_", " ");
  const labels: Record<string, string> = {
    draft: "草稿",
    submitted: "已提交",
    processing: "处理中",
    approved: "已批准",
    rejected: "已拒绝",
    completed: "已完成",
  };
  return labels[status.toLowerCase()] ?? status.replaceAll("_", " ");
}
