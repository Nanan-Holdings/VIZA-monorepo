"use client";

import { CircleNotch as Loader2, Trash as Trash2 } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PageBackButton } from "@/components/ui/page-back-button";

type TravelPreference = {
  id: string;
  key: string;
  value: string;
  created_at: string;
};

const KNOWN_KEYS = new Set(["interests", "pace", "dietary", "accommodation", "transport", "avoid"]);

export function TravelMemorySettings() {
  const t = useTranslations("settings.travelMemory");
  const settingsT = useTranslations("settings");
  const [items, setItems] = useState<TravelPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
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
      setLoadFailed(true);
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(t("mutationError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
      <PageBackButton
        fallbackHref="/client/settings"
        label={settingsT("commonBack")}
        className="h-11 w-11"
      />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        {items.length > 0 && !loadFailed ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-destructive"
                disabled={busyId !== null}
              >
                {busyId === "all" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("clearAll")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("clearDialogTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("clearDialogDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keepPreferences")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void remove()}
                >
                  {t("clearAll")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : loadFailed ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
            <ClientErrorAlert message={error} />
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void load()}
            >
              {settingsT("retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:anywhere]">
                  {KNOWN_KEYS.has(item.key) ? t(`keys.${item.key}`) : item.key}
                </p>
                <p className="mt-1 break-words text-base text-foreground [overflow-wrap:anywhere]">
                  {item.value}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    aria-label={t("deleteLabel")}
                    disabled={busyId !== null}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("deleteDialogTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("deleteDialogDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void remove(item.id)}
                    >
                      {t("delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </section>
      {error && !loadFailed ? <ClientErrorAlert className="mt-4" message={error} /> : null}
    </main>
  );
}
