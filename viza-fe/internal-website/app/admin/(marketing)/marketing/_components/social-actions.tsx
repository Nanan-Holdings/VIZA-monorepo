"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmMarketingImagePostsRemoved, publishMarketingSocialComposition, stopMarketingSocialComposition, syncMarketingSocialComposition } from "@/app/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { InterfaceLocale } from "@/lib/i18n/locale";

const COPY = {
  en: { reason: "Operational reason", publish: "Publish / retry", sync: "Sync", cancel: "Cancel schedule", unpublish: "Unpublish", removed: "I removed the image posts in Instagram/Pinterest", confirm: "Record removal" },
  zh: { reason: "运营原因", publish: "发布或重试", sync: "同步", cancel: "取消计划", unpublish: "撤下", removed: "我已在 Instagram/Pinterest 删除图片帖子", confirm: "记录已删除" },
} as const;

export function SocialActions({ id, locale, canManage, canPublish, canSync, canStop, scheduled, hasImagePosts }: { id: string; locale: InterfaceLocale; canManage: boolean; canPublish: boolean; canSync: boolean; canStop: boolean; scheduled: boolean; hasImagePosts: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [removed, setRemoved] = useState(false);
  const copy = COPY[locale];
  function run(kind: "publish" | "sync" | "stop" | "removed") { startTransition(async () => { const result = kind === "publish" ? await publishMarketingSocialComposition({ id, reason }) : kind === "stop" ? await stopMarketingSocialComposition({ id, reason }) : kind === "removed" ? await confirmMarketingImagePostsRemoved({ id, reason }) : await syncMarketingSocialComposition({ id }); setError(result.success ? null : result.error ?? "Operation failed."); if (result.success && kind === "removed") setRemoved(false); router.refresh(); }); }
  return <div className="flex min-w-[240px] flex-col gap-2">{canManage ? <Input value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} placeholder={copy.reason} /> : null}<div className="flex flex-wrap gap-2">{canManage ? <Button size="sm" disabled={pending || !canPublish || reason.trim().length < 5} onClick={() => run("publish")}>{copy.publish}</Button> : null}<Button size="sm" variant="outline" disabled={pending || !canSync} onClick={() => run("sync")}>{copy.sync}</Button>{canManage ? <Button size="sm" variant="destructive" disabled={pending || !canStop || reason.trim().length < 5} onClick={() => run("stop")}>{scheduled ? copy.cancel : copy.unpublish}</Button> : null}</div>{canManage && hasImagePosts ? <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={removed} onChange={(event) => setRemoved(event.target.checked)} />{copy.removed}</label> : null}{canManage && hasImagePosts ? <Button size="sm" variant="outline" disabled={pending || !removed || reason.trim().length < 5} onClick={() => run("removed")}>{copy.confirm}</Button> : null}{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>;
}
