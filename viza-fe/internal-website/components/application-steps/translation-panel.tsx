"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionRow, Section } from "./review-shared";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";

interface TranslationEntry {
  source_text: string;
  translated_text: string;
  user_edited: boolean;
}

type TranslationMap = Record<string, TranslationEntry>;

export interface TranslationPanelProps {
  applicationId: string;
  originalData?: {
    personal?: Partial<PersonalInfoData>;
    passport?: Partial<PassportData>;
    travel?: Partial<TravelInfoData>;
  };
  translationStatus?: "ok" | "failed" | "pending";
}

// ---------------------------------------------------------------------------
// TranslationRow — single editable translated field
// ---------------------------------------------------------------------------

function TranslationRow({
  label,
  fieldKey,
  entry,
  applicationId,
  onUpdated,
}: {
  label: string;
  fieldKey: string;
  entry: TranslationEntry;
  applicationId: string;
  onUpdated: (fieldKey: string, newText: string) => void;
}) {
  const t = useTranslations("applicationSteps.translation");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.translated_text);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === entry.translated_text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/translations/${encodeURIComponent(fieldKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translated_text: draft }),
        }
      );
      if (res.ok) {
        onUpdated(fieldKey, draft);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0 items-center">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 text-sm w-48"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
                if (e.key === "Escape") { setEditing(false); setDraft(entry.translated_text); }
              }}
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-right">{entry.translated_text}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {entry.user_edited ? t("userEdited") : t("aiTranslated")}
            </Badge>
            <button
              type="button"
              onClick={() => { setDraft(entry.translated_text); setEditing(true); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={t("editTranslation")}
            >
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field label mapping
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  surname: "review.surname",
  given_names: "review.givenNames",
  city_of_birth: "review.cityOfBirth",
  country_of_birth: "review.countryOfBirth",
  nationality: "review.nationality",
  marital_status: "review.maritalStatus",
  purpose_of_trip: "review.purpose",
  arrival_city: "review.arrivalCity",
  accommodation_name: "review.accommodation",
  us_address_street1: "review.usAddress",
};

const PERSONAL_FIELDS = ["surname", "given_names", "city_of_birth", "country_of_birth", "nationality", "marital_status"];
const TRAVEL_FIELDS = ["purpose_of_trip", "arrival_city", "accommodation_name", "us_address_street1"];

// ---------------------------------------------------------------------------
// TranslationPanel
// ---------------------------------------------------------------------------

export function TranslationPanel({ applicationId, originalData, translationStatus }: TranslationPanelProps) {
  const t = useTranslations("applicationSteps");
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/translations`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("translation.translationFailed"));
      const data: TranslationMap = await res.json();
      setTranslations(data);
    } catch {
      setError(t("translation.translationFailed"));
    } finally {
      setLoading(false);
    }
  }, [applicationId, t]);

  const retryTranslation = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(t("translation.translationFailed"));
      await fetchTranslations();
    } catch {
      setError(t("translation.translationFailed"));
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (translationStatus === "ok") {
      void fetchTranslations();
    } else if (translationStatus === "failed") {
      setLoading(false);
      setError(t("translation.translationFailed"));
    }
  }, [translationStatus, fetchTranslations, t]);

  const handleUpdated = (fieldKey: string, newText: string) => {
    setTranslations((prev) => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], translated_text: newText, user_edited: true },
    }));
  };

  const hasTranslations = Object.keys(translations).length > 0;
  const personalTranslations = PERSONAL_FIELDS.filter((k) => translations[k]);
  const travelTranslations = TRAVEL_FIELDS.filter((k) => translations[k]);
  const dynamicTranslations = Object.keys(translations).filter(
    (k) => !PERSONAL_FIELDS.includes(k) && !TRAVEL_FIELDS.includes(k)
  );

  function getLabel(fieldKey: string): string {
    const i18nKey = FIELD_LABELS[fieldKey];
    if (i18nKey) return t(i18nKey as Parameters<typeof t>[0]);
    // For dynamic fields, use the field key as fallback with formatting
    return fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error / retry state
  if (error && !hasTranslations) {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void retryTranslation()}
          disabled={retrying}
          className="shrink-0"
        >
          {retrying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {t("translation.retryTranslation")}
        </Button>
      </div>
    );
  }

  // No translations needed (all fields were already in English)
  if (!hasTranslations && !error) {
    return null;
  }

  return (
    <div className="mt-6">
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="zh">{t("translation.tabOriginal")}</TabsTrigger>
          <TabsTrigger value="en">{t("translation.tabEnglish")}</TabsTrigger>
        </TabsList>

        {/* Chinese original tab */}
        <TabsContent value="zh" className="flex flex-col gap-4 mt-4">
          {originalData?.personal && (
            <Section title={t("translation.sectionPersonal")}>
              <SectionRow label={t("review.surname")} value={originalData.personal.surname} />
              <SectionRow label={t("review.givenNames")} value={originalData.personal.givenNames} />
              <SectionRow label={t("review.nationality")} value={originalData.personal.nationality} />
              <SectionRow label={t("review.cityOfBirth")} value={originalData.personal.cityOfBirth} />
              <SectionRow label={t("review.countryOfBirth")} value={originalData.personal.countryOfBirth} />
            </Section>
          )}
          {originalData?.travel && (
            <Section title={t("translation.sectionTravel")}>
              <SectionRow label={t("review.purpose")} value={originalData.travel.purposeOfTrip} />
              <SectionRow label={t("review.arrivalCity")} value={originalData.travel.arrivalCity} />
              <SectionRow label={t("review.accommodation")} value={originalData.travel.accommodationName} />
              <SectionRow label={t("review.usAddress")} value={originalData.travel.usAddressStreet1} />
            </Section>
          )}
        </TabsContent>

        {/* English translation tab */}
        <TabsContent value="en" className="flex flex-col gap-4 mt-4">
          {personalTranslations.length > 0 && (
            <Section title={t("translation.sectionPersonal")}>
              {personalTranslations.map((key) => (
                <TranslationRow
                  key={key}
                  label={getLabel(key)}
                  fieldKey={key}
                  entry={translations[key]}
                  applicationId={applicationId}
                  onUpdated={handleUpdated}
                />
              ))}
            </Section>
          )}
          {travelTranslations.length > 0 && (
            <Section title={t("translation.sectionTravel")}>
              {travelTranslations.map((key) => (
                <TranslationRow
                  key={key}
                  label={getLabel(key)}
                  fieldKey={key}
                  entry={translations[key]}
                  applicationId={applicationId}
                  onUpdated={handleUpdated}
                />
              ))}
            </Section>
          )}
          {dynamicTranslations.length > 0 && (
            <Section title={t("translation.sectionDynamic")}>
              {dynamicTranslations.map((key) => (
                <TranslationRow
                  key={key}
                  label={getLabel(key)}
                  fieldKey={key}
                  entry={translations[key]}
                  applicationId={applicationId}
                  onUpdated={handleUpdated}
                />
              ))}
            </Section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
