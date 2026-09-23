"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMarketingShortLink, setMarketingShortLinkActive } from "@/app/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: { destination: "HTTPS destination", campaign: "Campaign", content: "Content key (optional)", reason: "Operational reason", create: "Create short link", working: "Working…", deactivate: "Deactivate", activate: "Activate" },
  zh: { destination: "HTTPS 目标地址", campaign: "活动名称", content: "内容标识（可选）", reason: "运营原因", create: "创建短链接", working: "处理中…", deactivate: "停用", activate: "启用" },
} as const;

export function CreateTrackingLink({ locale }: { locale: InterfaceLocale }) {
  const copy = COPY[locale]; const router = useRouter(); const [pending, startTransition] = useTransition(); const [error, setError] = useState<string | null>(null); const [created, setCreated] = useState<string | null>(null);
  return <form className="grid gap-3 md:grid-cols-2" action={(form) => startTransition(async () => { const result = await createMarketingShortLink({ destinationUrl: String(form.get("destinationUrl") ?? ""), campaign: String(form.get("campaign") ?? ""), contentKey: String(form.get("contentKey") ?? "") || undefined, reason: String(form.get("reason") ?? "") }); if (!result.success || !result.data) { setError(result.error ?? "Operation failed."); return; } setError(null); setCreated(result.data.shortUrl); router.refresh(); })}><Input name="destinationUrl" type="url" required placeholder={copy.destination} /><Input name="campaign" required placeholder={copy.campaign} /><Input name="contentKey" placeholder={copy.content} /><Input name="reason" required minLength={5} placeholder={copy.reason} /><div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={pending}>{pending ? copy.working : copy.create}</Button>{created ? <a className="text-sm text-primary underline" href={created} target="_blank" rel="noreferrer">{created}</a> : null}</div>{error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}</form>;
}

export function ToggleTrackingLink({ id, active, locale }: { id: string; active: boolean; locale: InterfaceLocale }) {
  const copy = COPY[locale]; const router = useRouter(); const [pending, startTransition] = useTransition(); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null);
  return <div className="flex min-w-[220px] flex-col gap-2"><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} placeholder={copy.reason} /><Button size="sm" variant={active ? "destructive" : "outline"} disabled={pending || reason.trim().length < 5} onClick={() => startTransition(async () => { const result = await setMarketingShortLinkActive({ id, active: !active, reason }); setError(result.success ? null : result.error ?? "Operation failed."); router.refresh(); })}>{active ? copy.deactivate : copy.activate}</Button>{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}
