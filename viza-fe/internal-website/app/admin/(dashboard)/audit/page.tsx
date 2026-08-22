import { getLocale } from "next-intl/server";
import { ScrollText, ShieldCheck } from "lucide-react";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface EventRow { id: string; actor_user_id: string | null; command: string; target_type: string; target_id: string; reason: string; before_state: Record<string, unknown>; after_state: Record<string, unknown>; evidence_redacted: Record<string, unknown>; created_at: string }
interface StaffRow { id: string; name: string | null; email: string | null }

const COPY = {
  en: { title: "Admin command audit", subtitle: "Who changed what, why, and the redacted state transition recorded before operational commands run.", events: "Recorded commands", actors: "Active staff actors", targets: "Target types", empty: "No admin command events recorded.", actor: "Actor", reason: "Reason", transition: "State transition", unavailable: "Audit storage is unavailable. Operational commands that require it will fail closed." },
  zh: { title: "管理命令审计", subtitle: "记录谁在何时、因为什么原因执行了什么操作，以及执行前保存的脱敏状态变化。", events: "命令记录", actors: "员工操作人", targets: "目标类型", empty: "暂无管理命令记录。", actor: "操作人", reason: "原因", transition: "状态变化", unavailable: "审计存储不可用。依赖审计的运营命令会安全停止。" },
} as const;

export default async function AdminAuditPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const { data, error } = await admin.from("admin_command_events").select("id, actor_user_id, command, target_type, target_id, reason, before_state, after_state, evidence_redacted, created_at").order("created_at", { ascending: false }).limit(500);
  const events = (data ?? []) as EventRow[];
  const actorIds = [...new Set(events.map((event) => event.actor_user_id).filter((id): id is string => Boolean(id)))];
  const { data: staffData } = actorIds.length ? await admin.from("users").select("id, name, email").in("id", actorIds) : { data: [] };
  const staff = new Map(((staffData ?? []) as StaffRow[]).map((row) => [row.id, row.name || row.email || row.id.slice(0, 8)]));
  const targets = new Set(events.map((event) => event.target_type));
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div><div className="flex items-center gap-2"><ScrollText className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div><p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{copy.events}</p><p className="mt-2 text-3xl font-semibold">{events.length}</p></div><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{copy.actors}</p><p className="mt-2 text-3xl font-semibold">{actorIds.length}</p></div><div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-[#64748b]">{copy.targets}</p><p className="mt-2 text-3xl font-semibold">{targets.size}</p></div></div>
    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><ShieldCheck className="mr-1 inline h-4 w-4" /><strong>{copy.unavailable}</strong><p className="mt-1 font-mono text-xs">{error.message}</p></div> : events.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.empty}</div> : <div className="space-y-3">{events.map((event) => <article key={event.id} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-700">{event.command}</span><span className="font-mono text-xs text-[#64748b]">{event.target_type}:{event.target_id.slice(0, 12)}</span></div><p className="mt-2 text-sm text-[#334155]"><strong>{copy.actor}:</strong> {event.actor_user_id ? staff.get(event.actor_user_id) || event.actor_user_id.slice(0, 8) : "system"}</p><p className="mt-1 text-sm text-[#64748b]"><strong>{copy.reason}:</strong> {event.reason}</p></div><time className="text-xs text-[#94a3b8]">{new Date(event.created_at).toLocaleString()}</time></div><details className="mt-3 rounded-lg bg-[#fafbfc] p-3"><summary className="cursor-pointer text-xs font-semibold text-[#64748b]">{copy.transition}</summary><div className="mt-2 grid gap-3 lg:grid-cols-2"><pre className="overflow-x-auto rounded bg-white p-2 text-xs text-[#475569]">{JSON.stringify(event.before_state, null, 2)}</pre><pre className="overflow-x-auto rounded bg-white p-2 text-xs text-[#475569]">{JSON.stringify(event.after_state, null, 2)}</pre></div></details></article>)}</div>}
  </div>;
}
