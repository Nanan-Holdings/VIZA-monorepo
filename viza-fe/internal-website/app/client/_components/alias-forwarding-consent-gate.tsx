"use client";

import { useEffect, useState } from "react";
import { CheckCircle as CheckCircle2, CircleNotch as Loader2, EnvelopeOpen as MailCheck } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import {
  authorizeAuthenticatedApplicantInboxForwarding,
  initializeAuthenticatedApplicantInbox,
  type ApplicantInboxActionErrorCode,
  type ApplicantInboxSetupState,
} from "@/app/actions/applicant-inbox";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isChineseLocale } from "@/lib/i18n/locale";

interface AliasForwardingConsentGateProps {
  enabled: boolean;
}

function actionErrorMessage(code: ApplicantInboxActionErrorCode, isZh: boolean): string {
  if (code === "AUTH_REQUIRED") {
    return isZh
      ? "登录状态已失效，请刷新页面后重新登录。"
      : "Your session has expired. Refresh the page and sign in again.";
  }
  if (code === "DESTINATION_EMAIL_REQUIRED") {
    return isZh
      ? "你的账号邮箱尚未完整配置，请先在设置中补充邮箱。"
      : "Your account email is not configured yet. Add it in Settings first.";
  }
  return isZh
    ? "邮箱授权服务暂时不可用，请稍后重试。你的申请资料不会丢失。"
    : "The email authorization service is temporarily unavailable. Please try again later; your application data is safe.";
}

export function AliasForwardingConsentGate({
  enabled,
}: AliasForwardingConsentGateProps) {
  const isZh = isChineseLocale(useLocale());
  const [setup, setSetup] = useState<ApplicantInboxSetupState | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    void initializeAuthenticatedApplicantInbox()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSetup(result.data);
        } else {
          setError(actionErrorMessage(result.error.code, isZh));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(actionErrorMessage("SERVICE_UNAVAILABLE", isZh));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, isZh]);

  if (!enabled || loading || setup?.forwardingAuthorized) {
    return null;
  }

  const authorize = async () => {
    if (!accepted || authorizing) return;
    setAuthorizing(true);
    setError(null);
    try {
      const result = await authorizeAuthenticatedApplicantInboxForwarding();
      if (result.ok) {
        setSetup(result.data);
      } else {
        setError(actionErrorMessage(result.error.code, isZh));
      }
    } catch {
      setError(actionErrorMessage("SERVICE_UNAVAILABLE", isZh));
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-xl gap-5 rounded-lg [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-2 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#003b7a]">
            <MailCheck className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl">
            {isZh ? "授权申请专属邮箱转发" : "Authorize your VIZA application email"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {isZh
              ? "VIZA 已为你的账号分配固定专属邮箱。今后所有申请都会使用此邮箱接收官网验证码、状态通知、二维码、PDF 和附件。"
              : "VIZA has assigned a permanent email alias to your account. All future applications will use it for official verification codes, status notices, QR codes, PDFs, and attachments."}
          </DialogDescription>
        </DialogHeader>

        {setup ? (
          <div className="space-y-3 rounded-md border bg-slate-50 p-4 text-sm">
            <div>
              <p className="text-slate-500">
                {isZh ? "你的固定申请邮箱" : "Your permanent application email"}
              </p>
              <p className="mt-1 break-all font-medium text-slate-950">{setup.alias}</p>
            </div>
            <div>
              <p className="text-slate-500">
                {isZh ? "转发至账号邮箱" : "Forwarded to your account email"}
              </p>
              <p className="mt-1 break-all font-medium text-slate-950">
                {setup.destinationEmail}
              </p>
            </div>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
          <Checkbox
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            className="mt-1"
          />
          <span>
            {isZh
              ? "我授权 VIZA 将发送到上述专属邮箱的官方邮件及附件转发到我的账号邮箱。若邮箱服务要求验证收件地址，我会自行完成该验证。"
              : "I authorize VIZA to forward official messages and attachments received at this alias to my account email. I will complete any destination-address verification required by the mail provider."}
          </span>
        </label>

        {error ? <ClientErrorAlert message={error} /> : null}

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            className="w-full bg-[#003b7a] hover:bg-[#002f62]"
            disabled={!setup || !accepted || authorizing}
            onClick={() => void authorize()}
          >
            {authorizing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isZh ? "授权并继续" : "Authorize and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
