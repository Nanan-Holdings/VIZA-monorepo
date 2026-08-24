"use client";

import { useState, useTransition } from "react";
import { Check, Copy, LinkSimple, Plus, Prohibit } from "@phosphor-icons/react";
import {
  createAdminRegistrationInvite,
  revokeAdminRegistrationInvite,
  type AdminRegistrationInvite,
} from "@/app/actions/admin-access";
import { ActionButton } from "@/components/ui/action-button";

type Locale = "en" | "zh";

const COPY = {
  en: {
    title: "Admin registration links",
    body: "Create a one-use link for a new teammate or an existing VIZA customer. The link expires after 24 hours and is bound to the first verified email that claims it.",
    reason: "Reason for audit",
    reasonPlaceholder: "New operations teammate",
    create: "Create link",
    creating: "Creating…",
    created: "Link created. Copy it now — the token is shown only once.",
    copy: "Copy link",
    copied: "Copied",
    status: "Status",
    expires: "Expires",
    claimed: "Claimed email",
    pending: "Pending",
    accepted: "Accepted",
    revoked: "Revoked",
    expired: "Expired",
    revoke: "Revoke",
    revoking: "Revoking…",
    revokeReason: "Revoke reason",
    noInvites: "No registration links yet.",
    unavailable: "Invitation data is temporarily unavailable.",
  },
  zh: {
    title: "管理员注册链接",
    body: "为新同事或已有 VIZA 客户创建一次性注册链接。链接 24 小时有效，并绑定第一个领取它的已验证邮箱。",
    reason: "审计原因",
    reasonPlaceholder: "新增运营同事",
    create: "创建链接",
    creating: "正在创建…",
    created: "链接已创建，请立即复制；token 只显示这一次。",
    copy: "复制链接",
    copied: "已复制",
    status: "状态",
    expires: "过期时间",
    claimed: "已绑定邮箱",
    pending: "待领取",
    accepted: "已接受",
    revoked: "已撤销",
    expired: "已过期",
    revoke: "撤销",
    revoking: "正在撤销…",
    revokeReason: "撤销原因",
    noInvites: "暂时没有注册链接。",
    unavailable: "邀请数据暂时不可用。",
  },
} as const;

function formatDate(value: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status: AdminRegistrationInvite["status"], copy: (typeof COPY)[Locale]): string {
  return status === "accepted" ? copy.accepted : status === "revoked" ? copy.revoked : status === "expired" ? copy.expired : status === "claimed" ? copy.claimed : copy.pending;
}

export default function InviteManager({ locale, invites }: { locale: Locale; invites: AdminRegistrationInvite[] }) {
  const copy = COPY[locale];
  const [reason, setReason] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createAdminRegistrationInvite({ reason });
      if (!result.success) {
        setError(copy.unavailable);
        return;
      }
      setInviteUrl(result.inviteUrl);
      setNotice(copy.created);
      setReason("");
    });
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(locale === "zh" ? "复制失败，请手动复制链接。" : "Copy failed. Please copy the link manually.");
    }
  };

  const revoke = (inviteId: string) => {
    const revokeReason = window.prompt(copy.revokeReason, locale === "zh" ? "链接不再需要" : "Link no longer needed");
    if (!revokeReason?.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await revokeAdminRegistrationInvite({ inviteId, reason: revokeReason });
      if (!result.success) setError(copy.unavailable);
      else setNotice(result.message ?? copy.revoked);
    });
  };

  return (
    <section className="rounded-2xl border border-[#d4e0f0] bg-white p-5 shadow-[0_14px_45px_rgba(3,52,110,0.06)] sm:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2"><LinkSimple className="size-5 text-[#03346e]" weight="duotone" aria-hidden="true" /><h2 className="font-heading text-xl font-semibold tracking-[-0.025em] text-[#03346e]">{copy.title}</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy.body}</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:max-w-xs">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500" htmlFor="invite-reason">{copy.reason}</label>
          <input id="invite-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.reasonPlaceholder} className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#03346e] focus:ring-4 focus:ring-[#03346e]/10" />
          <ActionButton type="button" variant="primary" size="sm" onClick={create} loading={pending} loadingText={copy.creating} className="rounded-full" disabled={pending || reason.trim().length < 3}><Plus className="size-4" weight="bold" />{copy.create}</ActionButton>
        </div>
      </div>

      {inviteUrl ? <div className="mt-5 rounded-xl border border-[#aabfdf] bg-[#eef3fa] p-4"><p className="text-sm font-medium text-[#03346e]">{notice ?? copy.created}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-[#aabfdf] bg-white px-3 text-xs text-slate-600" aria-label={copy.title} /><ActionButton type="button" variant="outline" size="sm" onClick={copyInvite} className="rounded-full border-[#03346e] text-[#03346e]"><>{copied ? <Check className="size-4" weight="bold" /> : <Copy className="size-4" />} {copied ? copy.copied : copy.copy}</></ActionButton></div></div> : null}
      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100">
        {invites.length === 0 ? <p className="p-6 text-sm text-slate-500">{copy.noInvites}</p> : <table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#fafafa] text-xs uppercase tracking-[0.1em] text-slate-500"><tr><th className="px-4 py-3">{copy.status}</th><th className="px-4 py-3">{copy.claimed}</th><th className="px-4 py-3">{copy.expires}</th><th className="px-4 py-3 text-right">&nbsp;</th></tr></thead><tbody>{invites.map((invite) => <tr key={invite.id} className="border-t border-slate-100"><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${invite.status === "accepted" ? "bg-emerald-50 text-emerald-700" : invite.status === "revoked" || invite.status === "expired" ? "bg-slate-100 text-slate-500" : invite.status === "claimed" ? "bg-amber-50 text-amber-700" : "bg-[#eef3fa] text-[#03346e]"}`}>{statusLabel(invite.status, copy)}</span></td><td className="px-4 py-3 text-slate-700">{invite.claimedEmail ?? "—"}</td><td className="px-4 py-3 text-slate-500">{formatDate(invite.expiresAt, locale)}</td><td className="px-4 py-3 text-right">{invite.status === "pending" || invite.status === "claimed" ? <button type="button" onClick={() => revoke(invite.id)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Prohibit className="size-3.5" />{pending ? copy.revoking : copy.revoke}</button> : null}</td></tr>)}</tbody></table>}
      </div>
    </section>
  );
}
