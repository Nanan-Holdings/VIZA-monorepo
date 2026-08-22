import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock3 } from "lucide-react";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireOverdueAppointmentAction, recordOfficialAppointmentConfirmation, updateAppointmentOperationCase } from "@/app/actions/admin-appointments";

export const dynamic = "force-dynamic";

interface JobRow {
  id: string;
  application_id: string;
  country_code: string;
  visa_type: string;
  applying_post_city: string | null;
  scheduling_provider: string | null;
  status: string;
  mode: string;
  requires_user_action: boolean;
  current_manual_action: string | null;
  last_error_message: string | null;
  updated_at: string;
}
interface ManualActionRow {
  id: string;
  job_id: string;
  action_type: string;
  status: string;
  instruction: string | null;
  expires_at: string | null;
}

interface ConfirmationRow {
  job_id: string;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_location: string | null;
  confirmation_number: string | null;
}
interface OperationCaseRow { appointment_job_id: string; status: string; assigned_to: string | null; next_action: string | null; resolution_code: string | null; resolution_notes: string | null }

const COPY = {
  en: {
    title: "Appointment operations",
    subtitle: "Visa appointment-assistance jobs, customer actions, expiry risk, and booking confirmations.",
    active: "Active jobs",
    action: "Action required",
    confirmed: "Confirmed",
    errors: "Errors",
    noJobs: "No appointment-assistance jobs found.",
    post: "Post",
    provider: "Provider",
    mode: "Mode",
    updated: "Updated",
    manual: "Manual/customer action",
    expires: "Expires",
    confirmation: "Appointment confirmation",
    openCase: "Open case",
    unavailable: "Some appointment data could not be loaded.",
    owner: "Operations owner",
    unassigned: "Unassigned",
    claim: "Claim case",
    nextAction: "Next action / reason",
    updateCase: "Update operations case",
    waitingCustomer: "Waiting for customer",
    resolve: "Resolve operations case",
    reopen: "Reopen",
    resolutionCode: "Resolution code",
    expireAction: "Expire overdue action",
    capture: "Capture missing official confirmation",
    captureHelp: "Recovery only: use details and evidence from the official provider. Dry-run jobs are blocked.",
    reference: "Official confirmation reference",
    date: "Appointment date",
    time: "Appointment time",
    location: "Appointment location",
    evidence: "Protected confirmation evidence URL",
    reason: "Required operational reason",
    saveConfirmation: "Save official confirmation",
  },
  zh: {
    title: "预约运营",
    subtitle: "集中管理签证预约任务、客户操作、到期风险和预约确认。",
    active: "活动任务",
    action: "需要处理",
    confirmed: "已确认",
    errors: "错误",
    noJobs: "暂无预约协助任务。",
    post: "领馆",
    provider: "服务商",
    mode: "模式",
    updated: "更新时间",
    manual: "人工/客户操作",
    expires: "到期时间",
    confirmation: "预约确认",
    openCase: "打开案件",
    unavailable: "部分预约数据无法加载。",
    owner: "运营负责人",
    unassigned: "未分配",
    claim: "领取案件",
    nextAction: "下一步操作/原因",
    updateCase: "更新运营案件",
    waitingCustomer: "等待客户",
    resolve: "解决运营案件",
    reopen: "重新打开",
    resolutionCode: "解决代码",
    expireAction: "将逾期操作标记为过期",
    capture: "补录缺失的官方预约确认",
    captureHelp: "仅用于恢复：必须使用官方服务商的真实资料和证据。演练任务不可操作。",
    reference: "官方确认编号",
    date: "预约日期",
    time: "预约时间",
    location: "预约地点",
    evidence: "受保护的确认凭证链接",
    reason: "必填运营原因",
    saveConfirmation: "保存官方确认",
  },
} as const;

function closed(status: string): boolean {
  return ["appointment_booked", "completed", "cancelled", "failed"].includes(status);
}

function tone(status: string): string {
  if (["appointment_booked", "completed", "confirmed"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["failed", "expired", "blocked"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  if (["pending", "requires_user_action", "waiting_for_user"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default async function AppointmentOperationsPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const [jobsResult, actionsResult, confirmationsResult, operationCasesResult] = await Promise.all([
    admin.from("appointment_assistance_jobs").select("id, application_id, country_code, visa_type, applying_post_city, scheduling_provider, status, mode, requires_user_action, current_manual_action, last_error_message, updated_at").order("updated_at", { ascending: false }).limit(250),
    admin.from("appointment_manual_actions").select("id, job_id, action_type, status, instruction, expires_at").in("status", ["pending", "in_progress"]).limit(250),
    admin.from("appointment_confirmations").select("job_id, appointment_date, appointment_time, appointment_location, confirmation_number").limit(250),
    admin.from("appointment_operation_cases").select("appointment_job_id, status, assigned_to, next_action, resolution_code, resolution_notes").limit(250),
  ]);
  const errors = [jobsResult, actionsResult, confirmationsResult, operationCasesResult].map((result) => result.error?.message).filter((message): message is string => Boolean(message));
  const jobs = (jobsResult.data ?? []) as JobRow[];
  const actionsByJob = new Map<string, ManualActionRow[]>();
  for (const action of (actionsResult.data ?? []) as ManualActionRow[]) actionsByJob.set(action.job_id, [...(actionsByJob.get(action.job_id) || []), action]);
  const confirmationByJob = new Map(((confirmationsResult.data ?? []) as ConfirmationRow[]).map((row) => [row.job_id, row]));
  const operationCases = new Map(((operationCasesResult.data ?? []) as OperationCaseRow[]).map((row) => [row.appointment_job_id, row]));
  const actionRequired = jobs.filter((job) => job.requires_user_action || (actionsByJob.get(job.id)?.length ?? 0) > 0).length;
  const confirmed = jobs.filter((job) => Boolean(confirmationByJob.get(job.id))).length;
  const failed = jobs.filter((job) => Boolean(job.last_error_message) || job.status === "failed").length;

  async function updateCase(formData: FormData) { "use server"; await updateAppointmentOperationCase({ jobId: String(formData.get("jobId")), operation: String(formData.get("operation")) as "claim" | "waiting_customer" | "resolve" | "reopen", reason: String(formData.get("reason") || "Claimed from appointment queue"), nextAction: String(formData.get("nextAction") || ""), resolutionCode: String(formData.get("resolutionCode") || "") }); }
  async function expireAction(formData: FormData) { "use server"; await expireOverdueAppointmentAction({ actionId: String(formData.get("actionId")), reason: String(formData.get("reason") || "") }); }
  async function captureConfirmation(formData: FormData) { "use server"; await recordOfficialAppointmentConfirmation({ jobId: String(formData.get("jobId")), confirmationNumber: String(formData.get("confirmationNumber") || ""), appointmentDate: String(formData.get("appointmentDate") || ""), appointmentTime: String(formData.get("appointmentTime") || ""), appointmentLocation: String(formData.get("appointmentLocation") || ""), evidenceUrl: String(formData.get("evidenceUrl") || ""), reason: String(formData.get("reason") || "") }); }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div><div className="flex items-center gap-2"><Calendar className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
      {errors.length > 0 ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">{copy.unavailable}</summary>{errors.map((error) => <p key={error} className="mt-1 font-mono text-xs">{error}</p>)}</details> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[copy.active, jobs.filter((job) => !closed(job.status)).length, Calendar], [copy.action, actionRequired, AlertTriangle], [copy.confirmed, confirmed, CheckCircle2], [copy.errors, failed, AlertTriangle]].map(([label, value, Icon]) => { const TileIcon = Icon as typeof Calendar; return <div key={String(label)} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-[#64748b]"><span>{String(label)}</span><TileIcon className="h-4 w-4 text-brand-500" /></div><p className="mt-2 text-3xl font-semibold text-[#232323]">{String(value)}</p></div>; })}</div>
      {jobs.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.noJobs}</div> : <div className="space-y-4">{jobs.map((job) => { const actions = actionsByJob.get(job.id) || []; const confirmation = confirmationByJob.get(job.id); const operationCase = operationCases.get(job.id); return <article key={job.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(job.status)}`}>{job.status.replaceAll("_", " ")}</span><span className="font-semibold text-[#334155]">{job.country_code} · {job.visa_type}</span>{operationCase ? <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-[#475569]">ops: {operationCase.status}</span> : null}</div><div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[#64748b] sm:grid-cols-2"><span>{copy.post}: <strong>{job.applying_post_city || "—"}</strong></span><span>{copy.provider}: <strong>{job.scheduling_provider || "—"}</strong></span><span>{copy.mode}: <strong>{job.mode}</strong></span><span>{copy.updated}: <strong>{new Date(job.updated_at).toLocaleString()}</strong></span><span>{copy.owner}: <strong>{operationCase?.assigned_to ? operationCase.assigned_to.slice(0, 8) : copy.unassigned}</strong></span>{operationCase?.next_action ? <span>{copy.nextAction}: <strong>{operationCase.next_action}</strong></span> : null}</div></div><Link href={`/admin/applications/${job.application_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{copy.openCase}<ArrowRight className="h-3.5 w-3.5" /></Link></div>{job.last_error_message ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mr-1 inline h-4 w-4" />{job.last_error_message}</p> : null}{actions.length > 0 ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3"><p className="text-sm font-semibold text-amber-900">{copy.manual}</p><ul className="mt-2 space-y-2">{actions.map((action) => <li key={action.id} className="text-sm text-amber-800"><span className="font-semibold">{action.action_type}</span>{action.instruction ? ` · ${action.instruction}` : ""}{action.expires_at ? <span className="ml-2 text-xs"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{copy.expires}: {new Date(action.expires_at).toLocaleString()}</span> : null}{action.expires_at && new Date(action.expires_at) <= new Date() ? <form action={expireAction} className="mt-2 flex gap-2"><input type="hidden" name="actionId" value={action.id} /><input name="reason" required minLength={5} placeholder={copy.reason} className="h-8 flex-1 rounded-md border px-2 text-xs" /><button className="h-8 rounded-md border border-amber-400 bg-white px-2 text-xs font-semibold">{copy.expireAction}</button></form> : null}</li>)}</ul></div> : null}{confirmation ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-sm font-semibold text-emerald-900">{copy.confirmation}</p><p className="mt-1 text-sm text-emerald-800">{confirmation.appointment_date || "—"} {confirmation.appointment_time || ""} · {confirmation.appointment_location || "—"}{confirmation.confirmation_number ? ` · ${confirmation.confirmation_number}` : ""}</p></div> : null}<div className="mt-4 grid gap-3 lg:grid-cols-2"><form action={updateCase} className="rounded-lg border bg-[#fafbfc] p-3"><input type="hidden" name="jobId" value={job.id} /><div className="grid gap-2 sm:grid-cols-2"><select name="operation" defaultValue={operationCase ? "waiting_customer" : "claim"} className="h-9 rounded-md border px-3 text-sm"><option value="claim">{copy.claim}</option><option value="waiting_customer">{copy.waitingCustomer}</option><option value="resolve">{copy.resolve}</option><option value="reopen">{copy.reopen}</option></select><input name="resolutionCode" placeholder={copy.resolutionCode} className="h-9 rounded-md border px-3 text-sm" /><input name="nextAction" placeholder={copy.nextAction} className="h-9 rounded-md border px-3 text-sm sm:col-span-2" /><input name="reason" required minLength={5} defaultValue={operationCase ? "" : "Claimed from appointment queue"} placeholder={copy.reason} className="h-9 rounded-md border px-3 text-sm sm:col-span-2" /></div><button className="mt-2 h-9 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white">{copy.updateCase}</button></form>{!confirmation && job.mode !== "dry_run" ? <details className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3"><summary className="cursor-pointer text-sm font-semibold text-emerald-900">{copy.capture}</summary><p className="mt-2 text-xs leading-5 text-emerald-800">{copy.captureHelp}</p><form action={captureConfirmation} className="mt-3 grid gap-2 sm:grid-cols-2"><input type="hidden" name="jobId" value={job.id} /><input name="confirmationNumber" required placeholder={copy.reference} className="h-9 rounded-md border px-3 text-sm" /><input name="appointmentDate" type="date" required className="h-9 rounded-md border px-3 text-sm" /><input name="appointmentTime" required placeholder={copy.time} className="h-9 rounded-md border px-3 text-sm" /><input name="appointmentLocation" required placeholder={copy.location} className="h-9 rounded-md border px-3 text-sm" /><input name="evidenceUrl" required placeholder={copy.evidence} className="h-9 rounded-md border px-3 text-sm sm:col-span-2" /><input name="reason" required minLength={5} placeholder={copy.reason} className="h-9 rounded-md border px-3 text-sm sm:col-span-2" /><button className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white sm:col-span-2">{copy.saveConfirmation}</button></form></details> : null}</div></article>; })}</div>}
    </div>
  );
}
