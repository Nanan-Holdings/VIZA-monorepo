"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageBackButton } from "@/components/ui/page-back-button";

type TravelPreference = {
  id: string;
  key: string;
  value: string;
  created_at: string;
};

const KEY_LABELS: Record<string, { zh: string; en: string }> = {
  interests: { zh: "兴趣", en: "Interests" },
  pace: { zh: "旅行节奏", en: "Travel pace" },
  dietary: { zh: "饮食需求", en: "Dietary needs" },
  accommodation: { zh: "住宿偏好", en: "Accommodation" },
  transport: { zh: "交通偏好", en: "Transport" },
  avoid: { zh: "希望避开", en: "Avoid" },
};

export function TravelMemorySettings() {
  const isZh = useLocale().toLowerCase().startsWith("zh");
  const [items, setItems] = useState<TravelPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/travel/preferences", {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        preferences?: TravelPreference[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "request_failed");
      setItems(body.preferences ?? []);
    } catch {
      setError(
        isZh
          ? "暂时无法读取旅行偏好，请稍后重试。"
          : "Travel preferences are temporarily unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, [isZh]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id?: string) {
    setBusyId(id ?? "all");
    setError("");
    try {
      const response = await fetch(
        `/api/travel/preferences${id ? `?id=${encodeURIComponent(id)}` : ""}`,
        { method: "DELETE" }
      );
      const body = (await response.json()) as {
        preferences?: TravelPreference[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "request_failed");
      setItems(body.preferences ?? []);
    } catch {
      setError(
        isZh
          ? "没有成功更新旅行偏好，请重试。"
          : "The travel preferences were not updated. Please retry."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageBackButton
        fallbackHref="/client/settings"
        label={isZh ? "返回上一页" : "Back to previous page"}
      />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isZh ? "旅行偏好记忆" : "Travel preference memory"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isZh
              ? "这里只保存你明确说过的长期旅行偏好。当前行程的目的地、日期和预算不会自动带入新的对话。"
              : "Only stable preferences you explicitly stated are kept here. Destinations, dates, and budgets from a trip are not copied into new chats."}
          </p>
        </div>
        {items.length > 0 ? (
          <Button
            variant="outline"
            className="rounded-full text-destructive"
            disabled={busyId !== null}
            onClick={() => void remove()}
          >
            {busyId === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isZh ? "全部清除" : "Clear all"}
          </Button>
        ) : null}
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {isZh
              ? "目前没有已保存的旅行偏好。"
              : "No travel preferences are currently saved."}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {KEY_LABELS[item.key]?.[isZh ? "zh" : "en"] ?? item.key}
                </p>
                <p className="mt-1 text-base text-foreground">{item.value}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={isZh ? "删除这项偏好" : "Delete this preference"}
                disabled={busyId !== null}
                onClick={() => void remove(item.id)}
              >
                {busyId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))
        )}
      </section>
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
