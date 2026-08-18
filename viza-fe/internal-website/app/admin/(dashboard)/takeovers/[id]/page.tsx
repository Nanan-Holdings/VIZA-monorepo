import Link from "next/link";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Clock3, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { TakeoverControls } from "./takeover-controls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface TakeoverRow {
  id: string;
  job_id: string;
  application_id: string;
  applicant_id: string;
  status: string;
  reason: string;
  claimed_by: string | null;
  claimed_at: string | null;
  closed_at: string | null;
  operator_notes: string | null;
  created_at: string;
}

interface LogRow {
  id: number;
  action: string;
  actor_user_id: string | null;
  detail: Record<string, unknown> | null;
  ts: string;
}

const COPY = {
  en: {
    back: "Back to takeovers",
    title: "Operator takeover",
    reason: "Why automation stopped",
    application: "Application",
    runner: "Runner job",
    created: "Created",
    claimed: "Claimed",
    closed: "Closed",
    audit: "Audit trail",
    noAudit: "No operator actions recorded.",
    claim: "Claim takeover",
    reveal: "Reveal secure session",
    secureSession: "Protected operator session",
    complete: "Complete takeover",
    abandon: "Abandon and escalate",
    notes: "Operator notes",
    answers: "Captured answer updates",
    answerHelp: "field_name=value, one per line; or a JSON object",
    abandonReason: "Required escalation reason",
  },
  zh: {
    back: "返回人工接管队列",
    title: "人工接管",
    reason: "自动化停止原因",
    application: "申请",
    runner: "自动化任务",
    created: "创建时间",
    claimed: "领取时间",
    closed: "关闭时间",
    audit: "审计记录",
    noAudit: "暂无操作记录。",
    claim: "领取接管",
    reveal: "显示安全会话",
    secureSession: "受保护的操作会话",
    complete: "完成接管",
    abandon: "放弃并升级",
    notes: "操作备注",
    answers: "补充的答案",
    answerHelp: "每行 field_name=value，或填写 JSON 对象",
    abandonReason: "必填的升级原因",
  },
} as const;

export default async function TakeoverDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") notFound();
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const { id } = await params;
  const admin = createAdminClient();
  const [{ data }, { data: logData }] = await Promise.all([
    admin.from("takeover_session").select("id, job_id, application_id, applicant_id, status, reason, claimed_by, claimed_at, closed_at, operator_notes, created_at").eq("id", id).maybeSingle(),
    admin.from("takeover_action_log").select("id, action, actor_user_id, detail, ts").eq("takeover_id", id).order("ts", { ascending: false }),
  ]);
  if (!data) notFound();
  const takeover = data as TakeoverRow;
  const logs = (logData ?? []) as LogRow[];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <Link href="/admin/takeovers" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" />{copy.back}</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Bot className="h-7 w-7 text-brand-500" />
          <h1 className="text-2xl font-semibold text-[#232323]">{copy.title} {takeover.id.slice(0, 8)}</h1>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{takeover.status}</span>
        </div>
      </div>

      <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{copy.reason}</p>
        <p className="mt-2 text-base font-medium text-[#334155]">{takeover.reason}</p>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Link href={`/admin/applications/${takeover.application_id}`} className="rounded-lg bg-[#fafbfc] p-3 hover:bg-brand-50"><FileText className="mb-2 h-4 w-4 text-brand-500" /><span className="block text-xs text-[#64748b]">{copy.application}</span><span className="font-mono text-xs text-[#334155]">{takeover.application_id.slice(0, 12)}</span></Link>
          <Link href={`/admin/jobs/${takeover.job_id}`} className="rounded-lg bg-[#fafbfc] p-3 hover:bg-brand-50"><Bot className="mb-2 h-4 w-4 text-brand-500" /><span className="block text-xs text-[#64748b]">{copy.runner}</span><span className="font-mono text-xs text-[#334155]">{takeover.job_id.slice(0, 12)}</span></Link>
          <div className="rounded-lg bg-[#fafbfc] p-3"><Clock3 className="mb-2 h-4 w-4 text-brand-500" /><span className="block text-xs text-[#64748b]">{copy.created}</span><span className="text-xs text-[#334155]">{new Date(takeover.created_at).toLocaleString()}</span></div>
          <div className="rounded-lg bg-[#fafbfc] p-3"><Clock3 className="mb-2 h-4 w-4 text-brand-500" /><span className="block text-xs text-[#64748b]">{takeover.closed_at ? copy.closed : copy.claimed}</span><span className="text-xs text-[#334155]">{takeover.closed_at || takeover.claimed_at ? new Date(takeover.closed_at || takeover.claimed_at || "").toLocaleString() : "—"}</span></div>
        </div>
      </section>

      <TakeoverControls takeoverId={takeover.id} status={takeover.status} claimedByCurrentUser={takeover.claimed_by === user.id} copy={copy} />

      <section className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
        <h2 className="border-b border-[#edf0f4] px-5 py-4 font-semibold text-[#232323]">{copy.audit}</h2>
        {logs.length === 0 ? <p className="p-5 text-sm text-[#64748b]">{copy.noAudit}</p> : (
          <ul className="divide-y divide-[#edf0f4]">{logs.map((log) => <li key={log.id} className="px-5 py-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-[#334155]">{log.action}</span><span className="text-xs text-[#94a3b8]">{new Date(log.ts).toLocaleString()}</span></div>{log.detail ? <pre className="mt-1 overflow-x-auto text-xs text-[#64748b]">{JSON.stringify(log.detail)}</pre> : null}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
