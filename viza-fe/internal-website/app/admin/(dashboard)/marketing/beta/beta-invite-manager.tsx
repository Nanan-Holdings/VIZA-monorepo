"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  initializeSocialBetaCohort,
  cancelUndeliveredSocialInvite,
  issueFriendBetaInvite,
  issueNextSocialBetaInvite,
  markSocialBetaInviteDelivered,
  type BetaOperatorErrorCode,
  type BetaOperatorState,
  type IssuedBetaInvite,
} from "@/app/actions/admin-beta";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Button } from "@/components/ui/button";

const COPY = {
  en: {
    socialTitle: "Social beta cohort",
    socialHelp: "Issue the next randomized A/B method after verification, then separately confirm actual delivery.",
    initialize: "Initialize randomized 100-person cohort",
    initializing: "Initializing…",
    notInitialized: "The social cohort has not been initialized.",
    progress: (issued: number, delivered: number, target: number, remaining: number) => `${issued}/${target} issued · ${delivered} delivered · ${remaining} issuable`,
    platform: "Platform",
    platformPlaceholder: "e.g. Instagram, TikTok, Xiaohongshu",
    recipient: "Recipient reference",
    recipientPlaceholder: "Account handle or internal recipient reference",
    email: "Intended applicant email",
    emailPlaceholder: "person@example.com (stored only as a keyed digest)",
    proof: "Engagement proof reference",
    proofPlaceholder: "Proof URL or approved internal evidence reference",
    issueNext: "Issue next social invite",
    issuing: "Issuing…",
    friendTitle: "Friend beta invitation",
    friendHelp: "Issue one promo code at a time for 100% off VIZA service fees across all countries. Government fees remain payable.",
    issueFriend: "Issue one friend promo code",
    issuedFriends: (count: number) => `${count} friend invitation${count === 1 ? "" : "s"} issued`,
    oneTime: "This plaintext value is shown only now. Send it before leaving this page.",
    undeliveredWarning: "Do not close, refresh, or navigate away until you confirm delivery. If the value was lost or not sent, cancel it below to revoke the code and release the slot.",
    deliveryReference: "Actual delivery reference",
    deliveryPlaceholder: "Support message/ticket ID or approved send evidence",
    markDelivered: "Confirm delivered",
    cancelReason: "Cancellation reason",
    cancelPlaceholder: "Why the plaintext was not delivered",
    cancelInvite: "Cancel and release slot",
    recoveryTitle: "Issued but not delivered",
    recoveryHelp: "Plaintext cannot be recovered. Cancel each lost invitation with a reason so its code is revoked and the randomized slot can be issued again.",
    nonePending: "No issued-undelivered invitations.",
    launchNotReady: "Invitation issuance is locked until the production identity-HMAC and checkout-handoff encryption keys are configured.",
    promo: "Promo code",
    link: "Unique link",
    slot: (slot: number) => `Social cohort slot ${slot}`,
    copy: "Copy",
    copied: "Copied",
    dismiss: "Dismiss",
    errors: {
      unauthorized: "You do not have permission to perform this action.",
      already_initialized: "The social cohort has already been initialized.",
      not_initialized: "Initialize the social cohort before issuing an invitation.",
      invalid_evidence: "Enter valid verification, intended email, delivery, or cancellation evidence for this action.",
      invalid_expiration: "The expiry must be a valid future date.",
      exhausted: "All 100 social cohort slots are currently issued.",
      conflict: "Another operator reserved this slot. Try again.",
      launch_not_ready: "Invitation issuance is locked because the production beta security configuration is incomplete.",
      backend_error: "The invitation could not be issued. Try again or contact an administrator.",
    },
  },
  zh: {
    socialTitle: "社交平台内测组",
    socialHelp: "完成审核后由系统发放下一种随机 A/B 方式，再单独确认邀请码已实际送达。",
    initialize: "初始化100人随机内测组",
    initializing: "正在初始化…",
    notInitialized: "社交平台内测组尚未初始化。",
    progress: (issued: number, delivered: number, target: number, remaining: number) => `已生成 ${issued}/${target} · 已送达 ${delivered} · 可发放 ${remaining}`,
    platform: "平台",
    platformPlaceholder: "例如：Instagram、TikTok、小红书",
    recipient: "用户标识",
    recipientPlaceholder: "平台账号或内部用户标识",
    email: "申请人预定邮箱",
    emailPlaceholder: "person@example.com（仅保存密钥摘要）",
    proof: "互动凭证",
    proofPlaceholder: "凭证链接或已审核的内部证据编号",
    issueNext: "发放下一位社交内测资格",
    issuing: "正在发放…",
    friendTitle: "朋友内测邀请码",
    friendHelp: "每次发放一个优惠码，可免除所有国家的 VIZA 服务费；政府官方费用仍需支付。",
    issueFriend: "发放一个朋友优惠码",
    issuedFriends: (count: number) => `已发放 ${count} 个朋友邀请码`,
    oneTime: "此明文仅在本次发放结果中显示，请在离开页面前完成发送。",
    undeliveredWarning: "确认送达前请勿关闭、刷新或离开此页面。若明文已丢失或未发送，请在下方取消，以撤销邀请码并释放名额。",
    deliveryReference: "实际送达凭证",
    deliveryPlaceholder: "客服消息/工单编号或批准的发送凭证",
    markDelivered: "确认已送达",
    cancelReason: "取消原因",
    cancelPlaceholder: "说明明文未送达的原因",
    cancelInvite: "取消并释放名额",
    recoveryTitle: "已生成但未送达",
    recoveryHelp: "邀请码明文无法恢复。请填写原因取消丢失的邀请码，系统会撤销代码并释放原随机名额。",
    nonePending: "目前没有待处理的未送达邀请码。",
    launchNotReady: "生产环境的身份 HMAC 密钥和结账交接加密密钥配置完成前，系统将锁定邀请码发放。",
    promo: "优惠码",
    link: "专属链接",
    slot: (slot: number) => `社交内测名额 ${slot}`,
    copy: "复制",
    copied: "已复制",
    dismiss: "关闭",
    errors: {
      unauthorized: "您没有权限执行此操作。",
      already_initialized: "社交平台内测组已经初始化。",
      not_initialized: "请先初始化社交平台内测组。",
      invalid_evidence: "请为当前操作填写有效的审核信息、预定邮箱、送达凭证或取消原因。",
      invalid_expiration: "有效期必须是未来的有效日期。",
      exhausted: "100个社交平台内测名额目前均已生成邀请码。",
      conflict: "另一位客服刚刚领取了该名额，请重试。",
      launch_not_ready: "生产环境的内测安全配置尚未完成，当前无法发放邀请码。",
      backend_error: "邀请码发放失败，请重试或联系管理员。",
    },
  },
} as const;

function InviteResult({ invite, locale, onDismiss }: {
  invite: IssuedBetaInvite;
  locale: "en" | "zh";
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = COPY[locale];
  const copyValue = async () => {
    await navigator.clipboard.writeText(invite.value);
    setCopied(true);
  };
  return <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
    <div>
      <p className="font-medium">{invite.slotNumber ? copy.slot(invite.slotNumber) : copy.friendTitle}</p>
      <p className="text-sm">{copy.oneTime}</p>
    </div>
    <label className="block space-y-1 text-sm">
      <span>{invite.deliveryMethod === "promo_code" ? copy.promo : copy.link}</span>
      <textarea readOnly rows={invite.deliveryMethod === "promo_code" ? 1 : 2} className="w-full rounded-md border bg-white p-3 font-mono text-xs" value={invite.value} onFocus={(event) => event.currentTarget.select()} />
    </label>
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={copyValue}>{copied ? copy.copied : copy.copy}</Button>
      <Button type="button" size="sm" variant="outline" onClick={onDismiss}>{copy.dismiss}</Button>
    </div>
  </div>;
}

function SocialInviteResult({ invite, locale, onComplete, onError }: {
  invite: IssuedBetaInvite;
  locale: "en" | "zh";
  onComplete: () => void;
  onError: (error: BetaOperatorErrorCode) => void;
}) {
  const copy = COPY[locale];
  const [copied, setCopied] = useState(false);
  const [deliveryReference, setDeliveryReference] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [pending, startTransition] = useTransition();
  const assignmentId = invite.assignmentId ?? "";
  const copyValue = async () => {
    await navigator.clipboard.writeText(invite.value);
    setCopied(true);
  };
  const markDelivered = () => startTransition(async () => {
    const result = await markSocialBetaInviteDelivered({ assignmentId, deliveryReference });
    if (!result.ok) return onError(result.error);
    onComplete();
  });
  const cancel = () => startTransition(async () => {
    const result = await cancelUndeliveredSocialInvite({ assignmentId, reason: cancelReason });
    if (!result.ok) return onError(result.error);
    onComplete();
  });

  return <div className="space-y-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
    <div>
      <p className="font-semibold">{copy.slot(invite.slotNumber ?? 0)}</p>
      <p className="text-sm">{copy.oneTime}</p>
      <p className="mt-2 rounded-md bg-amber-100 p-3 text-sm font-semibold">{copy.undeliveredWarning}</p>
    </div>
    <label className="block space-y-1 text-sm">
      <span>{invite.deliveryMethod === "promo_code" ? copy.promo : copy.link}</span>
      <textarea readOnly rows={invite.deliveryMethod === "promo_code" ? 1 : 2} className="w-full rounded-md border bg-white p-3 font-mono text-xs" value={invite.value} onFocus={(event) => event.currentTarget.select()} />
    </label>
    <Button type="button" size="sm" onClick={copyValue}>{copied ? copy.copied : copy.copy}</Button>
    <div className="grid gap-3 border-t border-amber-300 pt-4 md:grid-cols-2">
      <label className="space-y-1 text-sm"><span>{copy.deliveryReference}</span><input maxLength={500} className="h-10 w-full rounded-md border bg-white px-3" placeholder={copy.deliveryPlaceholder} value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} /></label>
      <div className="self-end"><Button type="button" onClick={markDelivered} disabled={pending || !deliveryReference.trim()}>{copy.markDelivered}</Button></div>
      <label className="space-y-1 text-sm"><span>{copy.cancelReason}</span><input maxLength={500} className="h-10 w-full rounded-md border bg-white px-3" placeholder={copy.cancelPlaceholder} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label>
      <div className="self-end"><Button type="button" variant="outline" onClick={cancel} disabled={pending || !cancelReason.trim()}>{copy.cancelInvite}</Button></div>
    </div>
  </div>;
}

function UndeliveredRecovery({ locale, state, onChanged, onError }: {
  locale: "en" | "zh";
  state: BetaOperatorState;
  onChanged: () => void;
  onError: (error: BetaOperatorErrorCode) => void;
}) {
  const copy = COPY[locale];
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const cancel = (assignmentId: string) => {
    setPendingId(assignmentId);
    void cancelUndeliveredSocialInvite({ assignmentId, reason: reasons[assignmentId] ?? "" })
      .then((result) => {
        if (!result.ok) onError(result.error);
        else onChanged();
      })
      .finally(() => setPendingId(null));
  };
  return <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div><h4 className="font-semibold">{copy.recoveryTitle} ({state.issuedUndelivered.length})</h4><p className="text-sm text-muted-foreground">{copy.recoveryHelp}</p></div>
    {state.issuedUndelivered.length === 0 ? <p className="text-sm">{copy.nonePending}</p> : state.issuedUndelivered.map((item) => <div key={item.assignmentId} className="grid gap-2 rounded-md border bg-white p-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
      <div className="text-sm"><p className="font-medium">{copy.slot(item.slotNumber)} · {item.deliveryMethod === "promo_code" ? copy.promo : copy.link}</p><p className="text-muted-foreground">{item.platform} · {item.recipientReference}</p></div>
      <label className="space-y-1 text-sm"><span>{copy.cancelReason}</span><input maxLength={500} className="h-9 w-full rounded-md border px-3" placeholder={copy.cancelPlaceholder} value={reasons[item.assignmentId] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [item.assignmentId]: event.target.value }))} /></label>
      <Button type="button" variant="outline" onClick={() => cancel(item.assignmentId)} disabled={pendingId === item.assignmentId || !(reasons[item.assignmentId] ?? "").trim()}>{copy.cancelInvite}</Button>
    </div>)}
  </div>;
}

export function BetaInviteManager({ locale, state }: {
  locale: "en" | "zh";
  state: BetaOperatorState;
}) {
  const router = useRouter();
  const copy = COPY[locale];
  const [platform, setPlatform] = useState("");
  const [recipientReference, setRecipientReference] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [socialInvite, setSocialInvite] = useState<IssuedBetaInvite | null>(null);
  const [friendInvite, setFriendInvite] = useState<IssuedBetaInvite | null>(null);
  const [error, setError] = useState<BetaOperatorErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!socialInvite) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [socialInvite]);

  const initialize = () => startTransition(async () => {
    setError(null);
    const result = await initializeSocialBetaCohort();
    if (!result.ok) setError(result.error);
    router.refresh();
  });

  const issueSocial = () => startTransition(async () => {
    setError(null);
    setSocialInvite(null);
    const result = await issueNextSocialBetaInvite({ platform, recipientReference, recipientEmail, proofReference });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSocialInvite(result.data.invite);
    setRecipientReference("");
    setRecipientEmail("");
    setProofReference("");
    router.refresh();
  });

  const issueFriend = () => startTransition(async () => {
    setError(null);
    setFriendInvite(null);
    const result = await issueFriendBetaInvite();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFriendInvite(result.data.invite);
    router.refresh();
  });

  return <div className="space-y-6">
    {error ? <ClientErrorAlert message={copy.errors[error]} /> : null}
    {!state.launchConfigReady ? <ClientErrorAlert message={copy.launchNotReady} /> : null}
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="font-semibold">{copy.socialTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy.socialHelp}</p>
        <p className="mt-2 text-sm font-medium">{state.initialized ? copy.progress(state.issued, state.delivered, state.targetCount, state.remainingIssuable) : copy.notInitialized}</p>
      </div>
      {!state.initialized && state.canInitialize ? <Button type="button" onClick={initialize} disabled={pending}>{pending ? copy.initializing : copy.initialize}</Button> : null}
      {state.initialized ? <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span>{copy.platform}</span><input maxLength={80} className="h-10 w-full rounded-md border bg-background px-3" placeholder={copy.platformPlaceholder} value={platform} onChange={(event) => setPlatform(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{copy.recipient}</span><input maxLength={240} className="h-10 w-full rounded-md border bg-background px-3" placeholder={copy.recipientPlaceholder} value={recipientReference} onChange={(event) => setRecipientReference(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{copy.email}</span><input type="email" autoComplete="off" maxLength={320} className="h-10 w-full rounded-md border bg-background px-3" placeholder={copy.emailPlaceholder} value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>{copy.proof}</span><input maxLength={500} className="h-10 w-full rounded-md border bg-background px-3" placeholder={copy.proofPlaceholder} value={proofReference} onChange={(event) => setProofReference(event.target.value)} /></label>
        <div className="md:col-span-2"><Button type="button" onClick={issueSocial} disabled={!state.launchConfigReady || pending || Boolean(socialInvite) || state.remainingIssuable === 0 || !platform.trim() || !recipientReference.trim() || !recipientEmail.trim() || !proofReference.trim()}>{copy.issueNext}</Button></div>
      </div> : null}
      {socialInvite ? <SocialInviteResult invite={socialInvite} locale={locale} onComplete={() => { setSocialInvite(null); router.refresh(); }} onError={setError} /> : null}
      <UndeliveredRecovery locale={locale} state={{ ...state, issuedUndelivered: state.issuedUndelivered.filter((item) => item.assignmentId !== socialInvite?.assignmentId) }} onChanged={() => router.refresh()} onError={setError} />
    </section>

    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="font-semibold">{copy.friendTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy.friendHelp}</p>
        <p className="mt-2 text-sm font-medium">{copy.issuedFriends(state.friendInvitesIssued)}</p>
      </div>
      <Button type="button" variant="outline" onClick={issueFriend} disabled={!state.launchConfigReady || pending}>{pending ? copy.issuing : copy.issueFriend}</Button>
      {friendInvite ? <InviteResult invite={friendInvite} locale={locale} onDismiss={() => setFriendInvite(null)} /> : null}
    </section>
  </div>;
}
