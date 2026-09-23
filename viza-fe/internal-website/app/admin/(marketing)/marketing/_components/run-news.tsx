"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runMarketingNewsNow } from "@/app/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import type { InterfaceLocale } from "@/lib/i18n/locale";

export function RunNewsButton({ locale, connected }: { locale: InterfaceLocale; connected: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const zh = locale === "zh";
  return <div className="flex flex-col items-start gap-1">
    <Button type="button" variant="outline" disabled={pending || !connected} onClick={() => startTransition(async () => {
      setError(null);
      const result = await runMarketingNewsNow();
      if (result.success && result.data) router.push(`/admin/marketing/blog/${result.data.draftId}`);
      else setError(result.error ?? (zh ? "生成失败。" : "Generation failed."));
      router.refresh();
    })}>{pending ? (zh ? "正在扫描和生成…" : "Scanning and drafting…") : (zh ? "立即运行新闻流程" : "Run news pipeline now")}</Button>
    {error ? <span role="alert" className="max-w-xs text-xs text-destructive">{error}</span> : null}
    {!connected ? <span className="text-xs text-muted-foreground">{zh ? "请先配置 DeepSeek 或 OpenRouter。" : "Configure DeepSeek or OpenRouter first."}</span> : null}
  </div>;
}
