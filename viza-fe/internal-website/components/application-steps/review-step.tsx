"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, CheckCircle2 } from "lucide-react";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";

interface ReviewStepProps {
  applicationId: string;
  data?: {
    personal?: Partial<PersonalInfoData>;
    passport?: Partial<PassportData>;
    travel?: Partial<TravelInfoData>;
  };
  onEdit?: (section: "personal" | "passport" | "travel" | "documents") => void;
  onComplete: (result: { confirmed: true }) => void;
}

function SectionRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
  onEdit,
  editLabel,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-brand-500">{title}</h3>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs">
            <Pencil className="h-3 w-3 mr-1" /> {editLabel}
          </Button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ReviewStep({ applicationId: _applicationId, data, onEdit, onComplete }: ReviewStepProps) {
  const t = useTranslations("applicationSteps");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{t("review.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data?.personal && (
          <Section title={t("review.personalInformation")} onEdit={() => onEdit?.("personal")} editLabel={t("edit")}>
            <SectionRow label={t("review.fullName")} value={data.personal.fullName} />
            <SectionRow label={t("review.dateOfBirth")} value={data.personal.dateOfBirth} />
            <SectionRow label={t("review.placeOfBirth")} value={data.personal.placeOfBirth} />
            <SectionRow label={t("review.gender")} value={data.personal.gender} />
            <SectionRow label={t("review.nationality")} value={data.personal.nationality} />
            <SectionRow label={t("review.occupation")} value={data.personal.occupation} />
            <SectionRow label={t("review.address")} value={data.personal.address} />
          </Section>
        )}

        {data?.passport && (
          <Section title={t("review.passportDetails")} onEdit={() => onEdit?.("passport")} editLabel={t("edit")}>
            <SectionRow label={t("review.passportNumber")} value={data.passport.passportNumber} />
            <SectionRow label={t("review.issueDate")} value={data.passport.issueDate} />
            <SectionRow label={t("review.expiryDate")} value={data.passport.expiryDate} />
            <SectionRow label={t("review.issuingCountry")} value={data.passport.issuingCountry} />
            <SectionRow label={t("review.issuingAuthority")} value={data.passport.issuingAuthority} />
          </Section>
        )}

        {data?.travel && (
          <Section title={t("review.travelInformation")} onEdit={() => onEdit?.("travel")} editLabel={t("edit")}>
            <SectionRow label={t("review.arrivalDate")} value={data.travel.arrivalDate} />
            <SectionRow label={t("review.departureDate")} value={data.travel.departureDate} />
            <SectionRow label={t("review.portOfEntry")} value={data.travel.portOfEntry} />
            <SectionRow label={t("review.purpose")} value={data.travel.purpose} />
            <SectionRow label={t("review.accommodation")} value={data.travel.accommodationName} />
          </Section>
        )}

        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-sm">{t("review.reviewMessage")}</p>
        </div>

        <Button
          className="bg-brand-500 hover:bg-brand-600 text-white"
          onClick={() => onComplete({ confirmed: true })}
        >
          {t("review.confirmAndSubmit")}
        </Button>
      </CardContent>
    </Card>
  );
}
