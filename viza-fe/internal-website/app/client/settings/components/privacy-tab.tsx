"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Download,
  CircleNotch as Loader2,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
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
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  createDataPrivacyRequest,
  getDataPrivacyRequests,
  type DataPrivacyRequestSummary,
  type PrivacyRequestType,
} from "@/app/actions/client-settings";

type Notice = {
  tone: "success" | "info" | "error";
  message: string;
};

const ACTIVE_STATUSES = new Set([
  "requested",
  "pending",
  "queued",
  "reviewing",
  "in_review",
  "in_progress",
  "processing",
  "approved",
]);

function requestKind(requestType: string): PrivacyRequestType | null {
  if (["export", "data_export", "personal_data_export", "access", "access_export"].includes(requestType)) {
    return "export";
  }
  if (["deletion", "delete", "data_deletion", "account_deletion", "account_cancellation", "erasure"].includes(requestType)) {
    return "deletion";
  }
  return null;
}

function RequestActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  disabled,
  isSubmitting,
  variant,
  onSubmit,
  action,
}: {
  icon: typeof Download;
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  isSubmitting: boolean;
  variant: "default" | "destructive";
  onSubmit?: () => void;
  action?: ReactNode;
}) {
  return (
    <motion.div
      className="flex h-full flex-col justify-between gap-5 rounded-xl border bg-white p-5 shadow-sm sm:p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg",
            variant === "destructive" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-500"
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ?? (
        <Button
          type="button"
          variant={variant}
          className="min-h-11 w-full sm:w-fit"
          disabled={disabled || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {buttonLabel}
        </Button>
      )}
    </motion.div>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  if (notice.tone === "error") {
    return <ClientErrorAlert message={notice.message} />;
  }

  return (
    <Alert variant={notice.tone}>
      <AlertIcon variant={notice.tone} />
      <AlertDescription>{notice.message}</AlertDescription>
    </Alert>
  );
}

export function PrivacyTab() {
  const t = useTranslations("settings.privacy");
  const settingsT = useTranslations("settings");
  const locale = useLocale();
  const [pendingType, setPendingType] = useState<PrivacyRequestType | null>(null);
  const [requests, setRequests] = useState<DataPrivacyRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const result = await getDataPrivacyRequests();
        if (!active) return;
        if (result.success) {
          setRequests(result.requests);
          setLoadFailed(false);
        } else {
          setLoadFailed(true);
        }
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const activeTypes = useMemo(() => {
    const types = new Set<PrivacyRequestType>();
    for (const request of requests) {
      const kind = requestKind(request.requestType);
      if (kind && ACTIVE_STATUSES.has(request.status.toLowerCase())) types.add(kind);
    }
    return types;
  }, [requests]);

  async function submitRequest(requestType: PrivacyRequestType) {
    if (pendingType) return;
    setPendingType(requestType);
    setNotice(null);

    try {
      const result = await createDataPrivacyRequest(requestType);
      if (result.success) {
        setRequests((current) => [
          result.request,
          ...current.filter((request) => request.id !== result.request.id),
        ]);
        setNotice({
          tone: result.alreadyPending ? "info" : "success",
          message: result.alreadyPending
            ? t(`${requestType}.alreadyPending`)
            : t(`${requestType}.submitted`),
        });
      } else {
        setNotice({ tone: "error", message: t("errors.submit") });
      }
    } catch {
      setNotice({ tone: "error", message: t("errors.submit") });
    } finally {
      setPendingType(null);
    }
  }

  function formatRequestDate(value: string | null) {
    if (!value) return t("history.dateUnavailable");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("history.dateUnavailable");
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function statusLabel(status: string) {
    const normalized = status.toLowerCase();
    if (["fulfilled", "completed"].includes(normalized)) return t("status.fulfilled");
    if (["rejected", "cancelled", "canceled", "closed"].includes(normalized)) {
      return t("status.closed");
    }
    return t("status.active");
  }

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{t("intro")}</p>

      {notice ? <NoticeMessage notice={notice} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <RequestActionCard
          icon={Download}
          title={t("export.title")}
          description={t("export.description")}
          buttonLabel={activeTypes.has("export") ? t("export.pendingButton") : t("export.button")}
          disabled={activeTypes.has("export") || pendingType !== null}
          isSubmitting={pendingType === "export"}
          variant="default"
          onSubmit={() => void submitRequest("export")}
        />

        <RequestActionCard
          icon={Trash2}
          title={t("deletion.title")}
          description={t("deletion.description")}
          buttonLabel={activeTypes.has("deletion") ? t("deletion.pendingButton") : t("deletion.button")}
          disabled={activeTypes.has("deletion") || pendingType !== null}
          isSubmitting={pendingType === "deletion"}
          variant="destructive"
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full sm:w-fit"
                  disabled={activeTypes.has("deletion") || pendingType !== null}
                >
                  {pendingType === "deletion" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {activeTypes.has("deletion") ? t("deletion.pendingButton") : t("deletion.button")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deletion.dialogTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("deletion.dialogDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("deletion.dialogCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void submitRequest("deletion")}
                  >
                    {t("deletion.dialogConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>

      <section className="space-y-3" aria-labelledby="privacy-request-history">
        <h2 id="privacy-request-history" className="text-lg font-semibold text-foreground">
          {t("history.title")}
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground" role="status">{t("history.loading")}</p>
        ) : loadFailed ? (
          <div className="space-y-3">
            <ClientErrorAlert message={t("errors.load")} />
            <Button type="button" variant="outline" onClick={() => setLoadAttempt((value) => value + 1)}>
              {settingsT("retry")}
            </Button>
          </div>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white" aria-label={t("history.title")}>
            {requests.map((request) => {
              const kind = requestKind(request.requestType);
              return (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {kind ? t(`${kind}.title`) : t("history.request")}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatRequestDate(request.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                    {statusLabel(request.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
