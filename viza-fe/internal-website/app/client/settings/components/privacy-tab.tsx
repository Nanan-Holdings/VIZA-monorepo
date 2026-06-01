"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { geist } from "../../../fonts";
import {
  createDataPrivacyRequest,
  type PrivacyRequestType,
} from "@/app/actions/client-settings";

type NoticeTone = "success" | "info" | "error";

type Notice = {
  tone: NoticeTone;
  message: string;
};

const COPY = {
  en: {
    title: "Privacy and data rights",
    intro:
      "Request a copy of your VIZA personal data or submit an account cancellation request.",
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
      title: "Cancel account",
      description:
        "Submit a request to cancel this VIZA account. The team will process account closure while preserving records that must be retained for visa, payment, tax, fraud-prevention, or legal reasons.",
      button: "Cancel account",
      pendingButton: "Cancellation requested",
      submitted: "Your account cancellation request has been received.",
      alreadyPending: "You already have an account cancellation request in progress.",
      dialogTitle: "Cancel this account?",
      dialogDescription:
        "This submits an account cancellation request. You may lose access after review is completed, while legally required records may be retained.",
      dialogCancel: "Keep account",
      dialogConfirm: "Cancel account",
    },
    errors: {
      submit: "We could not submit this request right now.",
    },
  },
  zh: {
    title: "隐私和数据权利",
    intro: "申请导出您的 VIZA 个人数据，或提交账号注销请求。",
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
      title: "注销账号",
      description:
        "提交 VIZA 账号注销请求。团队会处理账号关闭，同时按签证、付款、税务、防欺诈或法律要求保留必要记录。",
      button: "注销账号",
      pendingButton: "已申请注销",
      submitted: "我们已收到您的账号注销请求。",
      alreadyPending: "您已有一个正在处理的账号注销请求。",
      dialogTitle: "注销这个账号？",
      dialogDescription:
        "这会提交账号注销请求。审核完成后您可能无法继续访问该账号，但依法需要保留的记录仍会被保留。",
      dialogCancel: "保留账户",
      dialogConfirm: "注销账号",
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
  const copy = usePrivacyCopy();
  const [pendingType, setPendingType] = useState<PrivacyRequestType | null>(null);
  const [completedTypes, setCompletedTypes] = useState<Set<PrivacyRequestType>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  async function submitRequest(requestType: PrivacyRequestType) {
    setPendingType(requestType);
    setNotice(null);

    const result = await createDataPrivacyRequest(requestType);

    if (result.success) {
      setCompletedTypes((currentTypes) => new Set([...currentTypes, requestType]));
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
          buttonLabel={completedTypes.has("export") ? copy.export.pendingButton : copy.export.button}
          disabled={completedTypes.has("export")}
          isSubmitting={pendingType === "export"}
          variant="default"
          onSubmit={() => submitRequest("export")}
        />

        <RequestActionCard
          icon={Trash2}
          title={copy.deletion.title}
          description={copy.deletion.description}
          buttonLabel={completedTypes.has("deletion") ? copy.deletion.pendingButton : copy.deletion.button}
          disabled={completedTypes.has("deletion")}
          isSubmitting={pendingType === "deletion"}
          variant="destructive"
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full sm:w-fit"
                  disabled={completedTypes.has("deletion") || pendingType === "deletion"}
                >
                  {pendingType === "deletion" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {completedTypes.has("deletion") ? copy.deletion.pendingButton : copy.deletion.button}
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
    </div>
  );
}
