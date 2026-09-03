"use client";

import { useMemo, useState, useTransition } from "react";
import { Crown, Prohibit, ShieldCheck } from "@phosphor-icons/react";
import { grantHighAccess, revokeHighAccess, type HighAccessGrant } from "@/app/actions/admin-access";
import { ActionButton } from "@/components/ui/action-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";

type Locale = "en" | "zh";

const COPY = {
  en: {
    title: "High access",
    body: "High access waives the VIZA agency fee for this account. Applicable official fees remain payable per application. A grant is normally valid for one year and can be made permanent or revoked.",
    active: "Active",
    history: "Grant history",
    permanent: "Permanent",
    until: "Valid until",
    expired: "Expired",
    reason: "Reason for audit",
    placeholder: "Partner / staff access",
    year: "Grant / extend 1 year",
    permanentGrant: "Grant permanently",
    granting: "Saving…",
    revoke: "Revoke active access",
    revoking: "Revoking…",
    revokeReason: "Reason for revocation",
    noGrant: "No high access grant is active.",
    success: "High access updated.",
    error: "Unable to update high access.",
    grantedBy: "Granted by",
    revoked: "Revoked",
  },
  zh: {
    title: "High access 高权限",
    body: "High access 会豁免此账户的 VIZA 服务费，但每个申请适用的官方费仍需结算。默认有效一年，也可以设为永久或撤销。",
    active: "有效",
    history: "授权历史",
    permanent: "永久",
    until: "有效期至",
    expired: "已过期",
    reason: "审计原因",
    placeholder: "合作伙伴 / 员工权限",
    year: "授予 / 延长一年",
    permanentGrant: "设为永久",
    granting: "正在保存…",
    revoke: "撤销当前权限",
    revoking: "正在撤销…",
    revokeReason: "撤销原因",
    noGrant: "当前没有有效的 high access。",
    success: "High access 已更新。",
    error: "无法更新 high access。",
    grantedBy: "授予人",
    revoked: "已撤销",
  },
} as const;

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function HighAccessControls({ locale, userId, grants }: { locale: Locale; userId: string; grants: HighAccessGrant[] }) {
  const copy = COPY[locale];
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeGrant = useMemo(() => grants.find((grant) => grant.status === "active" && (grant.isPermanent || !grant.expiresAt || new Date(grant.expiresAt).getTime() > Date.now())), [grants]);

  const grant = (duration: "year" | "permanent") => {
    if (reason.trim().length < 3) {
      setError(locale === "zh" ? "请输入至少 3 个字符的审计原因。" : "Enter at least 3 characters for the audit reason.");
      return;
    }
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await grantHighAccess({ userId, duration, reason });
      if (!result.success) setError(copy.error);
      else { setNotice(result.message ?? copy.success); setReason(""); }
    });
  };

  const revoke = () => {
    if (!activeGrant) return;
    const revokeReason = window.prompt(copy.revokeReason, locale === "zh" ? "权限不再需要" : "Access no longer needed");
    if (!revokeReason?.trim()) return;
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await revokeHighAccess({ userId, reason: revokeReason });
      if (!result.success) setError(copy.error);
      else setNotice(result.message ?? copy.success);
    });
  };

  return (
    <section className="rounded-2xl border border-[#d4e0f0] bg-white p-6 shadow-[0_14px_45px_rgba(3,52,110,0.06)]">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-[#eef3fa] p-2.5 text-[#03346e]"><Crown className="size-5" weight="duotone" aria-hidden="true" /></div><div><h2 className="font-heading text-xl font-semibold tracking-[-0.025em] text-[#03346e]">{copy.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{copy.body}</p></div></div>
      {notice ? <Alert className="mt-4" variant="success"><AlertIcon variant="success" /><AlertDescription>{notice}</AlertDescription></Alert> : null}
      {error ? <Alert className="mt-4" variant="destructive"><AlertIcon variant="destructive" /><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className={`rounded-xl border p-4 ${activeGrant ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-[#fafafa]"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck className="size-4 text-[#03346e]" weight="duotone" />{activeGrant ? copy.active : copy.noGrant}</div>
          {activeGrant ? <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span>{activeGrant.isPermanent ? copy.permanent : `${copy.until}: ${formatDate(activeGrant.expiresAt, locale)}`}</span><span>{copy.grantedBy}: {activeGrant.grantedBy ?? "—"}</span></div> : null}
          {activeGrant ? <button type="button" onClick={revoke} disabled={pending} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Prohibit className="size-3.5" />{pending ? copy.revoking : copy.revoke}</button> : null}
        </div>
        <div className="min-w-0 rounded-xl border border-[#d4e0f0] bg-[#eef3fa]/60 p-4 lg:min-w-[300px]">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500" htmlFor="high-access-reason">{copy.reason}</label>
          <input id="high-access-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.placeholder} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" />
          <div className="mt-3 flex flex-wrap gap-2"><ActionButton type="button" variant="primary" size="sm" loading={pending} loadingText={copy.granting} onClick={() => grant("year")} disabled={pending || reason.trim().length < 3} className="rounded-full">{copy.year}</ActionButton><ActionButton type="button" variant="outline" size="sm" loading={pending} loadingText={copy.granting} onClick={() => grant("permanent")} disabled={pending || reason.trim().length < 3} className="rounded-full border-[#03346e] text-[#03346e]">{copy.permanentGrant}</ActionButton></div>
        </div>
      </div>
      <div className="mt-6"><h3 className="text-sm font-semibold text-slate-800">{copy.history}</h3><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">{grants.length ? grants.map((grantRow) => <div key={grantRow.id} className="flex flex-col gap-2 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2 font-medium text-slate-800"><span className={`size-2 rounded-full ${grantRow.status === "active" ? "bg-emerald-500" : grantRow.status === "revoked" ? "bg-red-400" : "bg-slate-300"}`} />{grantRow.status === "revoked" ? copy.revoked : grantRow.status === "active" ? copy.active : copy.expired}</span><span>{grantRow.isPermanent ? copy.permanent : `${copy.until}: ${formatDate(grantRow.expiresAt, locale)}`}</span><span>{formatDate(grantRow.createdAt, locale)}</span><span className="max-w-sm truncate">{grantRow.reason ?? "—"}</span></div>) : <p className="px-4 py-4 text-xs text-slate-500">{copy.noGrant}</p>}</div></div>
    </section>
  );
}
