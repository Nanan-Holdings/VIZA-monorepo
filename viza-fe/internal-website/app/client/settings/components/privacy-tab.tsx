"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useLocale } from "next-intl";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { geist } from "../../../fonts";
import {
  createDataPrivacyRequest,
  getDataPrivacyRequests,
  type DataPrivacyRequestSummary,
  type PrivacyRequestType,
} from "../actions";

type NoticeTone = "success" | "info" | "error";

type Notice = {
  tone: NoticeTone;
  message: string;
};

const ACTIVE_STATUSES = new Set([
  "requested",
  "pending",
  "queued",
  "reviewing",
  "in_review",
  "processing",
  "in_progress",
]);

const COPY = {
  en: {
    title: "Privacy and data rights",
    intro:
      "Request a copy of your VIZA personal data or ask our team to review your account for deletion.",
    export: {
      title: "Export personal data",
      description:
        "We will prepare a copy of personal data linked to your VIZA account and applications. Sensitive documents may require an identity check before delivery.",
      button: "Request export",
      pendingButton: "Export requested",
      submitted: "Your export request has been received.",
      alreadyPending: "You already have an export request in progress.",
    },
    deletion: {
      title: "Request deletion review",
      description:
        "Ask VIZA to delete data we no longer need. This creates a review request and does not immediately remove passports, applications, or payment records.",
      button: "Request deletion",
      pendingButton: "Deletion requested",
      submitted: "Your deletion review request has been received.",
      alreadyPending: "You already have a deletion request in progress.",
      dialogTitle: "Submit a deletion request?",
      dialogDescription:
        "This asks our privacy team to review your account for deletion. We may need to retain some visa, payment, tax, fraud-prevention, or legal records where required.",
      dialogCancel: "Keep account",
      dialogConfirm: "Submit request",
    },
    retention: {
      title: "Retention limits",
      body:
        "Deletion is not instant. Some records must be kept for visa processing, customer support, payment, tax, fraud-prevention, or legal obligations. We will only keep what is needed and will explain the outcome of your request.",
    },
    history: {
      title: "Request history",
      loading: "Loading privacy requests...",
      emptyTitle: "No privacy requests yet",
      emptyDescription: "Export and deletion requests you submit will appear here.",
      requested: "Requested",
      updated: "Last updated",
      fulfilled: "Completed",
      unavailable: "Date unavailable",
      error: "We could not load your request history.",
    },
    status: {
      requested: "Received",
      pending: "Received",
      queued: "Queued",
      reviewing: "In review",
      inReview: "In review",
      processing: "Processing",
      inProgress: "Processing",
      fulfilled: "Completed",
      completed: "Completed",
      rejected: "Closed",
      denied: "Closed",
      canceled: "Canceled",
      cancelled: "Canceled",
      unknown: "Status unavailable",
    },
    requestType: {
      export: "Personal data export",
      deletion: "Deletion review",
      other: "Privacy request",
    },
    errors: {
      submit: "We could not submit this request right now.",
    },
  },
  zh: {
    title: "隐私和数据权利",
    intro: "申请导出您的 VIZA 个人数据，或请我们的团队审核账户删除请求。",
    export: {
      title: "导出个人数据",
      description:
        "我们会准备与您的 VIZA 账户和申请相关的个人数据副本。敏感文件可能需要完成身份核验后再交付。",
      button: "申请导出",
      pendingButton: "已申请导出",
      submitted: "我们已收到您的数据导出请求。",
      alreadyPending: "您已有一个正在处理的数据导出请求。",
    },
    deletion: {
      title: "申请删除审核",
      description:
        "请 VIZA 删除不再需要的数据。此操作只会创建审核请求，不会立即移除护照、申请或付款记录。",
      button: "申请删除",
      pendingButton: "已申请删除",
      submitted: "我们已收到您的删除审核请求。",
      alreadyPending: "您已有一个正在处理的删除请求。",
      dialogTitle: "提交删除请求？",
      dialogDescription:
        "这会请隐私团队审核您的账户删除请求。根据签证、付款、税务、防欺诈或法律要求，我们可能需要保留部分记录。",
      dialogCancel: "保留账户",
      dialogConfirm: "提交请求",
    },
    retention: {
      title: "保留限制",
      body:
        "删除不会立即完成。部分记录可能因签证处理、客户支持、付款、税务、防欺诈或法律义务而需要保留。我们只会保留必要信息，并会说明请求处理结果。",
    },
    history: {
      title: "请求历史",
      loading: "正在加载隐私请求...",
      emptyTitle: "暂无隐私请求",
      emptyDescription: "您提交的数据导出和删除请求会显示在这里。",
      requested: "提交时间",
      updated: "最近更新",
      fulfilled: "完成时间",
      unavailable: "日期不可用",
      error: "暂时无法加载您的请求历史。",
    },
    status: {
      requested: "已收到",
      pending: "已收到",
      queued: "已排队",
      reviewing: "审核中",
      inReview: "审核中",
      processing: "处理中",
      inProgress: "处理中",
      fulfilled: "已完成",
      completed: "已完成",
      rejected: "已关闭",
      denied: "已关闭",
      canceled: "已取消",
      cancelled: "已取消",
      unknown: "状态不可用",
    },
    requestType: {
      export: "个人数据导出",
      deletion: "删除审核",
      other: "隐私请求",
    },
    errors: {
      submit: "暂时无法提交此请求。",
    },
  },
};

function usePrivacyCopy() {
  const locale = useLocale();
  return locale.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <motion.p
      className={`${geist.className} text-[22px] font-medium text-foreground sm:text-[26px] md:text-[32px]`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {title}
    </motion.p>
  );
}

function normalizeRequestType(requestType: string): PrivacyRequestType | "other" {
  const normalized = requestType.toLowerCase();

  if (normalized.includes("delete") || normalized.includes("deletion")) {
    return "deletion";
  }

  if (normalized.includes("export")) {
    return "export";
  }

  return "other";
}

function isActiveStatus(status: string) {
  return ACTIVE_STATUSES.has(status.toLowerCase());
}

function statusLabel(
  status: string,
  copy: (typeof COPY)["en"] | (typeof COPY)["zh"]
) {
  const normalized = status.toLowerCase();

  if (normalized === "requested") return copy.status.requested;
  if (normalized === "pending") return copy.status.pending;
  if (normalized === "queued") return copy.status.queued;
  if (normalized === "reviewing") return copy.status.reviewing;
  if (normalized === "in_review") return copy.status.inReview;
  if (normalized === "processing") return copy.status.processing;
  if (normalized === "in_progress") return copy.status.inProgress;
  if (normalized === "fulfilled") return copy.status.fulfilled;
  if (normalized === "completed") return copy.status.completed;
  if (normalized === "rejected") return copy.status.rejected;
  if (normalized === "denied") return copy.status.denied;
  if (normalized === "canceled") return copy.status.canceled;
  if (normalized === "cancelled") return copy.status.cancelled;

  return status ? status.replaceAll("_", " ") : copy.status.unknown;
}

function requestTypeLabel(
  requestType: string,
  copy: (typeof COPY)["en"] | (typeof COPY)["zh"]
) {
  const normalized = normalizeRequestType(requestType);
  return copy.requestType[normalized];
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function mergeRequest(
  requests: DataPrivacyRequestSummary[],
  nextRequest: DataPrivacyRequestSummary
) {
  const byId = new Map<string, DataPrivacyRequestSummary>();

  for (const request of [nextRequest, ...requests]) {
    byId.set(request.id, request);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
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
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
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
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {buttonLabel}
        </Button>
      )}
    </motion.div>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  const Icon = notice.tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
        notice.tone === "error" && "border-red-200 bg-red-50 text-red-700",
        notice.tone === "success" && "border-green-200 bg-green-50 text-green-700",
        notice.tone === "info" && "border-brand-100 bg-brand-50 text-brand-700"
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{notice.message}</span>
    </div>
  );
}

export function PrivacyTab() {
  const locale = useLocale();
  const copy = usePrivacyCopy();
  const [requests, setRequests] = useState<DataPrivacyRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<PrivacyRequestType | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      setIsLoading(true);
      setHistoryError(null);

      const result = await getDataPrivacyRequests();

      if (!isMounted) return;

      if (result.success) {
        setRequests(result.requests);
      } else {
        setHistoryError(copy.history.error);
      }

      setIsLoading(false);
    }

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [copy.history.error]);

  const activeExportRequest = useMemo(
    () =>
      requests.find(
        (request) =>
          normalizeRequestType(request.requestType) === "export" &&
          isActiveStatus(request.status)
      ),
    [requests]
  );

  const activeDeletionRequest = useMemo(
    () =>
      requests.find(
        (request) =>
          normalizeRequestType(request.requestType) === "deletion" &&
          isActiveStatus(request.status)
      ),
    [requests]
  );

  async function submitRequest(requestType: PrivacyRequestType) {
    setPendingType(requestType);
    setNotice(null);

    const result = await createDataPrivacyRequest(requestType);

    if (result.success) {
      setRequests((currentRequests) => mergeRequest(currentRequests, result.request));
      setNotice({
        tone: result.alreadyPending ? "info" : "success",
        message: result.alreadyPending
          ? copy[requestType].alreadyPending
          : copy[requestType].submitted,
      });
    } else {
      setNotice({
        tone: "error",
        message: copy.errors.submit,
      });
    }

    setPendingType(null);
  }

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-2">
        <SectionHeading title={copy.title} />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {copy.intro}
        </p>
      </div>

      {notice ? <NoticeMessage notice={notice} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <RequestActionCard
          icon={Download}
          title={copy.export.title}
          description={copy.export.description}
          buttonLabel={activeExportRequest ? copy.export.pendingButton : copy.export.button}
          disabled={Boolean(activeExportRequest)}
          isSubmitting={pendingType === "export"}
          variant="default"
          onSubmit={() => submitRequest("export")}
        />

        <RequestActionCard
          icon={Trash2}
          title={copy.deletion.title}
          description={copy.deletion.description}
          buttonLabel={activeDeletionRequest ? copy.deletion.pendingButton : copy.deletion.button}
          disabled={Boolean(activeDeletionRequest)}
          isSubmitting={pendingType === "deletion"}
          variant="destructive"
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full sm:w-fit"
                  disabled={Boolean(activeDeletionRequest) || pendingType === "deletion"}
                >
                  {pendingType === "deletion" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {activeDeletionRequest ? copy.deletion.pendingButton : copy.deletion.button}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{copy.deletion.dialogTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {copy.deletion.dialogDescription}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{copy.deletion.dialogCancel}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => submitRequest("deletion")}
                  >
                    {copy.deletion.dialogConfirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>

      <motion.div
        className="flex gap-4 rounded-xl border bg-white p-5 shadow-sm sm:p-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{copy.retention.title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{copy.retention.body}</p>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4">
        <SectionHeading title={copy.history.title} />
        <motion.div
          className="rounded-xl border bg-white p-4 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          {isLoading ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <p className="text-sm text-muted-foreground">{copy.history.loading}</p>
            </div>
          ) : historyError ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-red-600">{historyError}</p>
            </div>
          ) : requests.length === 0 ? (
            <Empty className="min-h-40 border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>{copy.history.emptyTitle}</EmptyTitle>
                <EmptyDescription>{copy.history.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {requests.map((request) => {
                const active = isActiveStatus(request.status);
                return (
                  <div
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    key={request.id}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-brand-50 text-brand-500" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {active ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {requestTypeLabel(request.requestType, copy)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {copy.history.requested}:{" "}
                          {formatDate(request.createdAt, locale, copy.history.unavailable)}
                        </p>
                        {request.fulfilledAt ? (
                          <p className="text-sm text-muted-foreground">
                            {copy.history.fulfilled}:{" "}
                            {formatDate(request.fulfilledAt, locale, copy.history.unavailable)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {copy.history.updated}:{" "}
                            {formatDate(request.updatedAt, locale, copy.history.unavailable)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={active ? "default" : "secondary"}
                      className="w-fit capitalize"
                    >
                      {statusLabel(request.status, copy)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
