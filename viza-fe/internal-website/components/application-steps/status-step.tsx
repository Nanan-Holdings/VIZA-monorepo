"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TranslationPanel } from "./translation-panel";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";

export interface StatusStepProps {
  applicationId?: string;
  confirmationNumber: string;
  submittedAt: string;
  estimatedProcessingDays: number;
  receiptUrl?: string;
  translationStatus?: "ok" | "failed" | "pending";
  originalData?: {
    personal?: Partial<PersonalInfoData>;
    passport?: Partial<PassportData>;
    travel?: Partial<TravelInfoData>;
  };
  onComplete?: (result: { acknowledged: true }) => void;
}

export function StatusStep({
  applicationId,
  confirmationNumber,
  submittedAt,
  estimatedProcessingDays,
  receiptUrl,
  translationStatus,
  originalData,
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
          <CardTitle className="font-heading text-lg">{t("status.title")} / Application Submitted</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-brand-50 border border-brand-100 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.confirmationNumber")} / Confirmation number</span>
            <span className="text-sm font-mono font-semibold text-brand-500">{confirmationNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.submittedOn")} / Submitted on</span>
            <span className="text-sm font-medium">{submittedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t("status.estimatedProcessing")} / Estimated processing</span>
            <span className="text-sm font-medium">{estimatedProcessingDays} {t("status.businessDays")}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t("status.message")}
          <br />
          Your application has been submitted. Keep your confirmation number for reference.
        </p>

        <div className="rounded-lg border border-[#03346E]/20 bg-[#03346E]/5 p-3">
          <p className="mb-2 text-sm font-medium text-[#03346E]">
            {t("status.travelPlannerTitle")} / Next step: Plan your trip
          </p>
          <p className="mb-3 text-xs text-gray-600">
            {t("status.travelPlannerHint")} / Build your itinerary, compare flights and hotels, and export Word/PDF.
          </p>
          <Button asChild className="w-full bg-[#03346E] text-white hover:bg-[#02264f]">
            <Link href="/client/travel-chat">{t("status.openTravelPlanner")} / Open Travel Chatbot</Link>
          </Button>
        </div>

        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              {t("status.viewReceipt")} / View Receipt
            </Button>
          </a>
        )}

        {applicationId && translationStatus && (
          <TranslationPanel
            applicationId={applicationId}
            originalData={originalData}
            translationStatus={translationStatus}
          />
        )}

        {onComplete && (
          <Button
            className="bg-brand-500 hover:bg-brand-600 text-white"
            onClick={() => onComplete({ acknowledged: true })}
          >
            {t("status.done")} / Done
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
