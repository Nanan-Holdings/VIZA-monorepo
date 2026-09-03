"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishMarketingSocialComposition, stopMarketingSocialComposition, syncMarketingSocialComposition } from "@/app/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { InterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: { reason: "Operational reason", publish: "Publish", sync: "Sync", cancel: "Cancel schedule", unpublish: "Unpublish" },
  zh: { reason: "运营原因", publish: "发布", sync: "同步", cancel: "取消计划", unpublish: "撤下" },
} as const;

export function SocialActions({ id, locale, canPublish, canSync, canStop, scheduled }: { id: string; locale: InterfaceLocale; canPublish: boolean; canSync: boolean; canStop: boolean; scheduled: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null);
  const copy = COPY[locale];
  function run(kind: "publish" | "sync" | "stop") { startTransition(async () => { const result = kind === "publish" ? await publishMarketingSocialComposition({ id, reason }) : kind === "stop" ? await stopMarketingSocialComposition({ id, reason }) : await syncMarketingSocialComposition({ id }); setError(result.success ? null : result.error ?? "Operation failed."); router.refresh(); }); }
  return <div className="flex min-w-[240px] flex-col gap-2"><Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} placeholder={copy.reason} /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending || !canPublish || reason.trim().length < 5} onClick={() => run("publish")}>{copy.publish}</Button><Button size="sm" variant="outline" disabled={pending || !canSync} onClick={() => run("sync")}>{copy.sync}</Button><Button size="sm" variant="destructive" disabled={pending || !canStop || reason.trim().length < 5} onClick={() => run("stop")}>{scheduled ? copy.cancel : copy.unpublish}</Button></div>{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}
