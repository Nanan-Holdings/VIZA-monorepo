"use client";

import { useLocale } from "next-intl";
import { UserCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";
import { getDestinationDisplayNameForLocale, getVisaTypeDisplayNameForLocale } from "@/lib/visa-destinations";
import type { ManualHandoffSubmissionResult } from "@/lib/submission-result";

/* The product has no automated submission, so a VIZA consultant files it.
   Shown from the moment the applicant submits until staff record the
   official outcome, which replaces this result. */
export function ManualHandoffResultCard({ result }: { result: ManualHandoffSubmissionResult }) {
  const locale = useLocale();
  const isZh = isChineseLocale(locale);
  const countryLabel = result.destinationCountry ? getDestinationDisplayNameForLocale(result.destinationCountry, locale) : "-";
  const visaLabel = result.visaType ? getVisaTypeDisplayNameForLocale(result.visaType, locale) : "-";
  const handed = new Date(result.handedAt);
  const handedLabel = Number.isFinite(handed.getTime())
    ? handed.toLocaleString(isZh ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short" })
    : null;
  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <UserCheck className="h-5 w-5 text-brand-500" />
            {isZh ? "已交给 VIZA 顾问" : "With your VIZA consultant"}
          </CardTitle>
          <Badge variant="default">{isZh ? "处理中" : "In progress"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh
            ? "这个签证目前不能自动提交，所以由 VIZA 顾问为你办理：顾问会核对你的回答和材料，然后在官方网站上为你提交。提交后或需要你补充信息时，我们会发邮件通知你。你现在不需要做任何事。"
            : "This visa cannot be submitted automatically yet, so a VIZA consultant handles it for you: they check your answers and documents, then file the application on the official site. We will email you when it is filed, or if we need anything from you. There is nothing you need to do right now."}
        </p>
        <div className="rounded-md border border-input bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">{isZh ? "国家 / 签证类型" : "Country / visa type"}</div>
          <div className="mt-0.5 text-sm text-foreground">
            {countryLabel} / {visaLabel}
          </div>
        </div>
        {handedLabel ? (
          <p className="text-xs text-muted-foreground">
            {isZh ? `提交给顾问的时间：${handedLabel}` : `Handed to your consultant: ${handedLabel}`}
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isZh
            ? "官方费用（如有）需在官方网站支付；VIZA 不收取服务费。"
            : "Any official government fee is paid on the official site; VIZA charges no service fee."}
        </p>
      </CardContent>
    </Card>
  );
}
