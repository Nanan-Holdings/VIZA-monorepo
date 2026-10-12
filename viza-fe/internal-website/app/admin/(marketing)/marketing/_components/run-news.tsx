"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runMarketingNewsNow } from "@/app/actions/admin-marketing";
import type { InterfaceLocale } from "@/lib/i18n/locale";

/* Starts the same run the schedule does: scan the feeds, rank the stories,
   read the winner and draft it. It takes a minute or two, so the button says
   so rather than just spinning. */
export function RunNewsButton({ locale, connected }: { locale: InterfaceLocale; connected: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const zh = locale === "zh";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {pending || error || !connected ? (
        <span className="mkt-note" style={{ maxWidth: 320 }}>
          {pending
            ? zh
              ? "正在扫描行业新闻并起草，需要一两分钟。"
              : "Scanning the industry and drafting. This takes a minute or two."
            : error
              ? error
              : zh
                ? "请先配置 DeepSeek 或 OpenRouter。"
                : "Configure DeepSeek or OpenRouter first."}
        </span>
      ) : null}
      <button
        type="button"
        className="mkt-btn mkt-btn--secondary"
        disabled={pending || !connected}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await runMarketingNewsNow();
            if (result.success && result.data) router.push(`/admin/marketing/blog/${result.data.draftId}`);
            else setError(result.error ?? (zh ? "生成失败。" : "Generation failed."));
            router.refresh();
          })
        }
      >
        {pending ? (zh ? "运行中…" : "Running…") : zh ? "立即运行" : "Run now"}
      </button>
    </div>
  );
}
