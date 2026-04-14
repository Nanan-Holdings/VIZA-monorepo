"use client";

import { useTranslations, useLocale } from "next-intl";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface StatusStepProps {
  applicationId?: string;
  confirmationNumber: string;
  submittedAt: string;
  estimatedProcessingDays: number;
  receiptUrl?: string;
  onComplete?: (result: { acknowledged: true }) => void;
}

export function StatusStep({
  confirmationNumber,
  submittedAt,
  estimatedProcessingDays,
  receiptUrl,
  onComplete,
}: StatusStepProps) {
  const t = useTranslations("applicationSteps");
  const locale = useLocale();

  const submittedDate = new Date(submittedAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="font-heading text-lg">{t("status.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-brand-50 border border-brand-100 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.confirmationNumber")}</span>
            <span className="text-sm font-mono font-semibold text-brand-500">{confirmationNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.submittedOn")}</span>
            <span className="text-sm font-medium">{submittedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.estimatedProcessing")}</span>
            <span className="text-sm font-medium">{estimatedProcessingDays} {t("status.businessDays")}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t("status.message")}
        </p>

        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              {t("status.viewReceipt")}
            </Button>
          </a>
        )}

        {onComplete && (
          <Button
            className="bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => onComplete({ acknowledged: true })}
          >
            {t("status.done")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
