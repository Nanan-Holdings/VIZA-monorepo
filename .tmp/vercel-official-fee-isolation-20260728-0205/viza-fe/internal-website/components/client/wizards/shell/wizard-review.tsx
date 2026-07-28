"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmissionDisclaimerDialog } from "@/components/application-steps/submission-disclaimer-dialog";
import type { WizardConfig } from "./types";

interface WizardReviewProps<TForm> {
  config: WizardConfig<TForm>;
  form: TForm;
  onEditStep: (stepKey: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

const ZH_REVIEW_KEY_LABELS: Record<string, string> = {
  identity: "身份",
  personal: "个人信息",
  contact: "联系方式",
  passport: "护照",
  document: "证件",
  travel: "旅行",
  trip: "行程",
  tripDates: "行程日期",
  tripDestination: "目的地",
  accommodation: "住宿",
  occupation: "职业",
  work: "工作与教育",
  usStay: "美国住宿",
  usContact: "美国联系人",
  family: "家庭",
  familyEu: "欧盟亲属",
  background: "背景",
  purpose: "目的",
  funding: "资金",
  declaration: "声明",
  sponsor: "担保人",
  host: "联系人",
  travelHistory: "旅行历史",
  stream: "签证类别",
  applicationContext: "申请背景",
  visit: "访问",
  companions: "同行人",
  health: "健康",
  character: "品格",
};

function fallbackReviewLabel(key: string, locale: string): string {
  const parts = key.split(".");
  const last = parts.at(-1) ?? key;
  const semanticKey = ["label", "title", "subtitle"].includes(last)
    ? parts.at(-2) ?? last
    : last;

  if (locale.toLowerCase().startsWith("zh")) {
    return ZH_REVIEW_KEY_LABELS[semanticKey] ?? semanticKey;
  }

  return semanticKey
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function WizardReview<TForm>({
  config,
  form,
  onEditStep,
  onSubmit,
  submitting,
}: WizardReviewProps<TForm>) {
  const locale = useLocale();
  const tShared = useTranslations("simplifiedForm.shared");
  const tCountry = useTranslations(config.i18nNamespace);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const sections = config.reviewSections(form);

  const tr = (key: string): string => {
    if (key.startsWith("literal:")) return key.slice("literal:".length);
    if (tCountry.has(key as never)) return tCountry(key as never);
    if (tShared.has(key as never)) return tShared(key as never);
    return fallbackReviewLabel(key, locale);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {tr("review.title")}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{tr("review.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-4">
        {sections.map((section, idx) => (
          <section
            key={`${section.titleKey}-${idx}`}
            className="rounded-xl border border-border/60 bg-white p-4 sm:p-5"
          >
            <header className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">{tr(section.titleKey)}</h2>
              {section.editStepKey ? (
                <button
                  type="button"
                  onClick={() => onEditStep(section.editStepKey!)}
                  className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand-500 hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  {tShared("edit")}
                </button>
              ) : null}
            </header>
            {section.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tShared("review.empty")}</p>
            ) : (
              <dl className="divide-y divide-border/60 text-sm">
                {section.rows.map((row, i) => (
                  <div key={`${row.labelKey}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-muted-foreground">{tr(row.labelKey)}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {row.value || tShared("review.notProvided")}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>

      <Button onClick={() => setDisclaimerOpen(true)} disabled={submitting} size="lg" className="self-stretch">
        {submitting ? (
          tShared("submitting")
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {tShared("review.submit")}
          </>
        )}
      </Button>

      <SubmissionDisclaimerDialog
        open={disclaimerOpen}
        submitting={submitting}
        onCancel={() => setDisclaimerOpen(false)}
        onConfirm={onSubmit}
      />
    </div>
  );
}
