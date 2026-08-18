import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Clock3, ShieldCheck, UserCheck } from "lucide-react";
import { updateAdminPrivacyRequest } from "@/app/actions/admin-privacy";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";
import { PrivacyExecutionControls } from "./privacy-execution-controls";

export const dynamic = "force-dynamic";

interface RequestRow {
  id: string;
  applicant_id: string;
  application_id: string | null;
  request_type: string;
  status: string;
  notes: string | null;
  identity_verified_at: string | null;
  due_at: string | null;
  assigned_to: string | null;
  legal_hold: boolean;
  retention_notes: string | null;
  export_storage_path: string | null;
  created_at: string;
}

interface ProfileRow { id: string; full_name: string | null; email: string | null }
interface ExecutionRow { privacy_request_id: string; status: string; requested_by: string | null }

const COPY = {
  en: {
    title: "Privacy request operations",
    subtitle: "Identity verification, ownership, legal holds, fulfillment evidence, and auditable decisions.",
    open: "Open",
    unassigned: "Unassigned",
    overdue: "Overdue",
    holds: "Legal holds",
    empty: "No privacy requests found.",
    identity: "Identity",
    verified: "Verified",
    notVerified: "Not verified",
    due: "Due",
    notes: "Customer notes",
    assign: "Assign to me",
    verify: "Verify identity",
    fulfill: "Fulfill",
    reject: "Reject",
    hold: "Place legal hold",
    release: "Release legal hold",
    reason: "Required decision reason",
    evidence: "Evidence/export reference",
    openCase: "Open case",
    unavailable: "Privacy workflow data is unavailable.",
    generateExport: "Generate secure export",
    downloadExport: "Download (2FA)",
    prepareErasure: "Prepare erasure",
    approveErasure: "Second-admin approval",
    executeErasure: "Execute erasure",
    typeConfirmation: "Type confirmation",
    secondAdmin: "Erasure requires a different admin to approve it.",
    twoFactor: "Execution and export download require a current 2FA session.",
    execution: "Execution",
    commandFailed: "Command failed",
  },
  zh: {
    title: "隐私请求运营",
    subtitle: "管理身份核验、负责人、法律保留、履行证据和可审计决定。",
    open: "处理中",
    unassigned: "未分配",
    overdue: "已超时",
    holds: "法律保留",
    empty: "暂无隐私请求。",
    identity: "身份",
    verified: "已核验",
    notVerified: "未核验",
    due: "截止时间",
    notes: "客户备注",
    assign: "分配给我",
    verify: "核验身份",
    fulfill: "完成请求",
    reject: "拒绝",
    hold: "设置法律保留",
    release: "解除法律保留",
    reason: "必填的决定原因",
    evidence: "证据/导出文件引用",
    openCase: "打开案件",
    unavailable: "隐私请求工作流数据不可用。",
    generateExport: "生成安全导出",
    downloadExport: "下载（需双重验证）",
    prepareErasure: "准备删除",
    approveErasure: "第二位管理员批准",
    executeErasure: "执行删除",
    typeConfirmation: "输入确认文字",
    secondAdmin: "删除操作必须由另一位管理员批准。",
    twoFactor: "执行删除和下载导出均需要当前双重验证会话。",
    execution: "执行状态",
    commandFailed: "操作失败",
  },
} as const;

function isOpen(status: string) { return !["fulfilled", "rejected", "cancelled"].includes(status); }
function tone(status: string) { return status === "fulfilled" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"; }

export default async function AdminPrivacyPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const user = await getCurrentUser();
  const [{ data, error }, executionsResult] = await Promise.all([
    admin.from("data_privacy_requests").select("id, applicant_id, application_id, request_type, status, notes, identity_verified_at, due_at, assigned_to, legal_hold, retention_notes, export_storage_path, created_at").order("created_at", { ascending: false }).limit(250),
    admin.from("privacy_execution_jobs").select("privacy_request_id, status, requested_by").eq("operation", "erasure"),
  ]);
  const requests = (data ?? []) as RequestRow[];
  const applicantIds = [...new Set(requests.map((request) => request.applicant_id).filter(Boolean))];
  const { data: profilesData } = applicantIds.length ? await admin.from("applicant_profiles").select("id, full_name, email").in("id", applicantIds) : { data: [] };
  const profiles = new Map(((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const executions = new Map(((executionsResult.data ?? []) as ExecutionRow[]).map((row) => [row.privacy_request_id, row]));
  const now = new Date();
  const metrics = { open: requests.filter((request) => isOpen(request.status)).length, unassigned: requests.filter((request) => isOpen(request.status) && !request.assigned_to).length, overdue: requests.filter((request) => isOpen(request.status) && request.due_at && new Date(request.due_at) < now).length, holds: requests.filter((request) => request.legal_hold).length };

  async function command(formData: FormData) {
    "use server";
    await updateAdminPrivacyRequest({ requestId: String(formData.get("requestId")), operation: String(formData.get("operation")) as "assign" | "verify_identity" | "fulfill" | "reject" | "place_legal_hold" | "release_legal_hold", reason: String(formData.get("reason") || "Assigned from privacy queue"), evidenceReference: String(formData.get("evidenceReference") || "") });
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[copy.open, metrics.open], [copy.unassigned, metrics.unassigned], [copy.overdue, metrics.overdue], [copy.holds, metrics.holds]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{label}</p><p className="mt-2 text-3xl font-semibold text-[#232323]">{value}</p></div>)}</div>
    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{copy.unavailable}</strong><p className="mt-1 font-mono text-xs">{error.message}</p></div> : requests.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.empty}</div> : <div className="space-y-4">{requests.map((request) => { const profile = profiles.get(request.applicant_id); const overdue = Boolean(request.due_at && isOpen(request.status) && new Date(request.due_at) < now); return <article key={request.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(request.status)}`}>{request.status}</span><span className="font-semibold text-[#334155]">{request.request_type.replaceAll("_", " ")}</span>{request.legal_hold ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{copy.holds}</span> : null}</div><p className="mt-2 text-sm text-[#64748b]">{profile?.full_name || profile?.email || request.applicant_id}</p><div className="mt-2 flex flex-wrap gap-4 text-xs text-[#64748b]"><span>{copy.identity}: <strong className={request.identity_verified_at ? "text-emerald-700" : "text-amber-700"}>{request.identity_verified_at ? copy.verified : copy.notVerified}</strong></span><span className={overdue ? "font-semibold text-red-700" : ""}><Clock3 className="mr-1 inline h-3.5 w-3.5" />{copy.due}: {request.due_at ? new Date(request.due_at).toLocaleString() : "—"}</span></div>{request.notes ? <p className="mt-3 rounded-lg bg-[#fafbfc] p-3 text-sm text-[#475569]"><strong>{copy.notes}:</strong> {request.notes}</p> : null}</div>{request.application_id ? <Link href={`/admin/applications/${request.application_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{copy.openCase}<ArrowRight className="h-3.5 w-3.5" /></Link> : null}</div>
      {isOpen(request.status) ? <div className="mt-4 flex flex-wrap gap-2">{!request.assigned_to ? <form action={command}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="operation" value="assign" /><button className="inline-flex h-9 items-center gap-1 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white"><UserCheck className="h-4 w-4" />{copy.assign}</button></form> : null}{!request.identity_verified_at ? <form action={command}><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="operation" value="verify_identity" /><input name="reason" required placeholder={copy.reason} className="h-9 rounded-md border px-3 text-sm" /><button className="ml-2 h-9 rounded-md border border-emerald-300 px-3 text-sm font-semibold text-emerald-700">{copy.verify}</button></form> : null}<details className="w-full rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold text-[#334155]">{copy.reject} / {request.legal_hold ? copy.release : copy.hold}</summary><form action={command} className="mt-3 grid gap-2 md:grid-cols-4"><input type="hidden" name="requestId" value={request.id} /><select name="operation" className="h-9 rounded-md border px-3 text-sm"><option value="reject">{copy.reject}</option><option value={request.legal_hold ? "release_legal_hold" : "place_legal_hold"}>{request.legal_hold ? copy.release : copy.hold}</option></select><input name="reason" required placeholder={copy.reason} className="h-9 rounded-md border px-3 text-sm" /><input name="evidenceReference" placeholder={copy.evidence} className="h-9 rounded-md border px-3 text-sm" /><button className="h-9 rounded-md bg-[#232323] px-3 text-sm font-semibold text-white">{copy.fulfill}</button></form></details></div> : null}
      {request.identity_verified_at && !request.legal_hold ? <PrivacyExecutionControls requestId={request.id} requestType={request.request_type} exportPath={request.export_storage_path} executionStatus={executions.get(request.id)?.status ?? null} requestedByCurrentUser={Boolean(user?.id && executions.get(request.id)?.requested_by === user.id)} copy={copy} /> : null}
    </article>; })}</div>}
  </div>;
}
