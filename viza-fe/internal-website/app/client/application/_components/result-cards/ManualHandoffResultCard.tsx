"use client";

import { useLocale } from "next-intl";
import { CheckCircle, FileText, UserCheck, Warning, XCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";
import { getDestinationDisplayNameForLocale, getVisaTypeDisplayNameForLocale } from "@/lib/visa-destinations";
import type { ManualHandoffSubmissionResult } from "@/lib/submission-result";

type Status = ManualHandoffSubmissionResult["status"];

const COPY: Record<Status, { en: { title: string; badge: string; body: string }; zh: { title: string; badge: string; body: string } }> = {
  handed_to_team: {
    en: {
      title: "With your VIZA consultant",
      badge: "In progress",
      body: "This visa cannot be submitted automatically yet, so a VIZA consultant handles it for you: they check your answers and documents, then file the application on the official site. We will email you when it is filed, or if we need anything from you. There is nothing you need to do right now.",
    },
    zh: {
      title: "已交给 VIZA 顾问",
      badge: "处理中",
      body: "这个签证目前不能自动提交，所以由 VIZA 顾问为你办理：顾问会核对你的回答和材料，然后在官方网站上为你提交。提交后或需要你补充信息时，我们会发邮件通知你。你现在不需要做任何事。",
    },
  },
  submitted: {
    en: {
      title: "Filed with the government",
      badge: "Submitted",
      body: "Your consultant has filed your application on the official site. The government now reviews it; we will email you as soon as there is a decision.",
    },
    zh: {
      title: "已向官方提交",
      badge: "已提交",
      body: "顾问已在官方网站为你提交申请，现在由官方审核。一有结果，我们会立即发邮件通知你。",
    },
  },
  approved: {
    en: {
      title: "Approved",
      badge: "Approved",
      body: "Good news: your application was approved. Download your document under Receipts & results below and keep a copy with your passport when you travel.",
    },
    zh: {
      title: "已获批准",
      badge: "已批准",
      body: "好消息：你的申请已获批准。请在下方“回执与结果”中下载文件，出行时与护照一起随身携带。",
    },
  },
  refused: {
    en: {
      title: "Not approved",
      badge: "Refused",
      body: "The government did not approve this application. Your consultant's note is below; reply to our email if you want help with next steps.",
    },
    zh: {
      title: "未获批准",
      badge: "未批准",
      body: "官方未批准这份申请。顾问的说明见下方；如需帮助安排下一步，请直接回复我们的邮件。",
    },
  },
  needs_info: {
    en: {
      title: "We need something from you",
      badge: "Action needed",
      body: "Your consultant needs more information before filing. See their note below, update your application or reply to our email, and they will continue.",
    },
    zh: {
      title: "需要你补充信息",
      badge: "需处理",
      body: "顾问提交前还需要更多信息。请查看下方说明，更新申请或直接回复我们的邮件，顾问会继续办理。",
    },
  },
};

const ICONS: Record<Status, typeof UserCheck> = {
  handed_to_team: UserCheck,
  submitted: FileText,
  approved: CheckCircle,
  refused: XCircle,
  needs_info: Warning,
};

/* The product has no automated submission, so a VIZA consultant files it.
   Shown from the moment the applicant submits; staff move the same result
   through submitted, approved, refused or needs_info from admin. */
export function ManualHandoffResultCard({ result }: { result: ManualHandoffSubmissionResult }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const status: Status = result.status in COPY ? result.status : "handed_to_team";
  const copy = COPY[status][isZh ? "zh" : "en"];
  const Icon = ICONS[status];
  const countryLabel = result.destinationCountry ? getDestinationDisplayNameForLocale(result.destinationCountry, locale) : "-";
  const visaLabel = result.visaType ? getVisaTypeDisplayNameForLocale(result.visaType, locale) : "-";
  const formatDate = (value: string | null | undefined) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime())
      ? date.toLocaleString(isZh ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short" })
      : null;
  };
  const handedLabel = formatDate(result.handedAt);
  const updatedLabel = status === "handed_to_team" ? null : formatDate(result.updatedAt);
  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <Icon className="h-5 w-5 text-brand-500" />
            {copy.title}
          </CardTitle>
          <Badge variant={status === "refused" || status === "needs_info" ? "secondary" : "default"}>{copy.badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        {result.notes && (status === "refused" || status === "needs_info") ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs text-amber-800">{isZh ? "顾问说明" : "Note from your consultant"}</div>
            <p className="mt-0.5 whitespace-pre-line text-sm text-foreground">{result.notes}</p>
          </div>
        ) : null}
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">{isZh ? "国家 / 签证类型" : "Country / visa type"}</div>
          <div className="mt-0.5 text-sm text-foreground">
            {countryLabel} / {visaLabel}
          </div>
        </div>
        {result.reference ? (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">{isZh ? "官方编号" : "Government reference"}</div>
            <div className="mt-0.5 font-mono text-sm font-medium text-foreground">{result.reference}</div>
          </div>
        ) : null}
        <div className="space-y-1 text-xs text-muted-foreground">
          {handedLabel ? <p>{isZh ? `提交给顾问的时间：${handedLabel}` : `Handed to your consultant: ${handedLabel}`}</p> : null}
          {updatedLabel ? <p>{isZh ? `最近更新：${updatedLabel}` : `Last update: ${updatedLabel}`}</p> : null}
        </div>
        {status === "handed_to_team" || status === "needs_info" ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isZh
              ? "官方费用（如有）需在官方网站支付；VIZA 不收取服务费。"
              : "Any official government fee is paid on the official site; VIZA charges no service fee."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
