import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { auditPiiRead } from "@/lib/legal/audit-pii";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AssignPackageForm } from "./assign-package-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");

  const adminClient = createAdminClient();

  // Parallel data fetching
  const [profileRes, packagesRes, applicationsRes, answersRes, visaPackagesRes] =
    await Promise.all([
      adminClient
        .from("applicant_profiles")
        .select("*")
        .eq("id", id)
        .single(),
      adminClient
        .from("user_packages")
        .select("*, visa_packages(name, country, visa_type)")
        .eq(
          "auth_user_id",
          (
            await adminClient
              .from("applicant_profiles")
              .select("auth_user_id")
              .eq("id", id)
              .single()
          ).data?.auth_user_id ?? ""
        )
        .order("created_at", { ascending: false }),
      adminClient
        .from("applications")
        .select("*")
        .eq("applicant_id", id)
        .order("created_at", { ascending: false }),
      adminClient
        .from("visa_application_answers")
        .select("field_name, value_text, value_json, updated_at")
        .in(
          "application_id",
          (
            await adminClient
              .from("applications")
              .select("id")
              .eq("applicant_id", id)
          ).data?.map((a: { id: string }) => a.id) ?? []
        ),
      adminClient
        .from("visa_packages")
        .select("id, name, country, visa_type")
        .eq("is_active", true),
    ]);

  const profile = profileRes.data;
  if (!profile) {
    return (
      <div className="w-full p-6 md:p-8">
        <p className="text-[#6b6b6b]">User not found.</p>
        <Link href="/admin/users" className="text-brand-500 hover:underline mt-2 inline-block">
          Back to users
        </Link>
      </div>
    );
  }

  const packages = packagesRes.data ?? [];
  const applications = applicationsRes.data ?? [];
  const answers = answersRes.data ?? [];
  const visaPackages = visaPackagesRes.data ?? [];

  await auditPiiRead(
    "app/admin/users/[id]:detail",
    profile.id,
    ["passport", "contact", "address", "form_answers"],
    { purpose: "admin_review" },
  );

  return (
    <div className="w-full p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-sm text-brand-500 hover:underline mb-1 inline-block">
            &larr; Back to users
          </Link>
          <h1 className="text-2xl font-semibold text-[#232323]">
            {profile.full_name || "Unnamed User"}
          </h1>
          <p className="text-sm text-[#6b6b6b]">{profile.email}</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#232323] mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Field label="Full Name" value={profile.full_name} />
          <Field label="Email" value={profile.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="Date of Birth" value={profile.date_of_birth} />
          <Field label="Nationality" value={profile.nationality} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Occupation" value={profile.occupation} />
          <Field label="Passport Number" value={profile.passport_number} />
          <Field label="Passport Expiry" value={profile.passport_expiry_date} />
          <Field label="Passport Issuing Country" value={profile.passport_issuing_country} />
          <Field label="Address" value={profile.address} />
          <Field label="WeChat" value={profile.wechat} />
        </div>
      </div>

      {/* Package History + Assign */}
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#232323]">Package History</h2>
        </div>

        {packages.length > 0 ? (
          <div className="space-y-3 mb-6">
            {packages.map((pkg: Record<string, unknown>) => (
              <div
                key={pkg.id as string}
                className="flex items-center justify-between border rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-medium text-sm">
                    {(pkg.visa_packages as Record<string, string>)?.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-[#6b6b6b] ml-2">
                    Assigned {new Date(pkg.assigned_at as string).toLocaleDateString()}
                  </span>
                </div>
                <PackageStatusBadge status={pkg.status as string} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9ca3af] mb-6">No packages assigned yet.</p>
        )}

        <AssignPackageForm
          userId={profile.auth_user_id ?? ""}
          visaPackages={visaPackages as Array<{ id: string; name: string; country: string; visa_type: string }>}
        />
      </div>

      {/* Applications */}
      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#232323] mb-4">Applications</h2>
        {applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Country</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Visa Type</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Created</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app: Record<string, unknown>) => (
                  <tr key={app.id as string} className="border-b">
                    <td className="px-3 py-2">{app.country as string}</td>
                    <td className="px-3 py-2">{app.visa_type as string}</td>
                    <td className="px-3 py-2">
                      <AppStatusBadge status={app.status as string} />
                    </td>
                    <td className="px-3 py-2 text-[#6b6b6b]">
                      {new Date(app.created_at as string).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#9ca3af]">No applications yet.</p>
        )}
      </div>

      {/* Application Answers */}
      {answers.length > 0 && (
        <div className="bg-white rounded-lg border border-[#efefef] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#232323] mb-4">
            Application Answers ({answers.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#fafafa]">
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Field</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Value</th>
                  <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {answers.map((a: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2 font-mono text-xs">{a.field_name as string}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate">
                      {a.value_json
                        ? JSON.stringify(a.value_json)
                        : (a.value_text as string) ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[#6b6b6b]">
                      {a.updated_at
                        ? new Date(a.updated_at as string).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[#6b6b6b] text-xs">{label}</dt>
      <dd className="font-medium text-[#232323]">{value || "—"}</dd>
    </div>
  );
}

function PackageStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function AppStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-50 text-blue-700",
    processing: "bg-yellow-50 text-yellow-700",
    approved: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    completed: "bg-green-50 text-green-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}
