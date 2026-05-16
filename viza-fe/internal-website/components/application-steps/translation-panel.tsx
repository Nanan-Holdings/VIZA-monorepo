"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BilingualReviewPanel, type ReviewRow } from "./bilingual-review-panel";
import type { PersonalInfoData } from "./personal-info-step";
import type { PassportData } from "./passport-step";
import type { TravelInfoData } from "./travel-info-step";

const BACKEND_URL = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:8080";

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

const PERSONAL_FIELDS = [
  "surname",
  "given_names",
  "city_of_birth",
  "country_of_birth",
  "nationality",
  "marital_status",
];
const TRAVEL_FIELDS = [
  "purpose_of_trip",
  "arrival_city",
  "accommodation_name",
  "us_address_street1",
];
const PASSPORT_SPELLING_FIELDS = new Set([
  "surname",
  "given_names",
  "city_of_birth",
  "place_of_birth",
  "passport_issuance_city",
]);

function formatFieldKey(fieldKey: string): string {
  return fieldKey.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TranslationPanel({ applicationId, translationStatus }: TranslationPanelProps) {
  const t = useTranslations("applicationSteps");
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translations`);
      if (!res.ok) throw new Error(`Failed to fetch translations (${res.status})`);
      const data = (await res.json()) as TranslationMap;
      setTranslations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("translation.translationFailed"));
    } finally {
      setLoading(false);
    }
  }, [applicationId, t]);

  const retryTranslation = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/applications/${applicationId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Translation failed (${res.status})`);
      await fetchTranslations();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("translation.translationFailed"));
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

  const rows: ReviewRow[] = Object.entries(translations).map(([fieldKey, entry]) => {
    const i18nKey = FIELD_LABELS[fieldKey];
    const inPersonal = PERSONAL_FIELDS.includes(fieldKey);
    const inTravel = TRAVEL_FIELDS.includes(fieldKey);

    return {
      section: inPersonal
        ? t("translation.sectionPersonal")
        : inTravel
          ? t("translation.sectionTravel")
          : t("translation.sectionDynamic"),
      fieldName: fieldKey,
      label: i18nKey ? t(i18nKey as Parameters<typeof t>[0]) : formatFieldKey(fieldKey),
      sourceValue: entry.source_text,
      officialValue: entry.translated_text,
      badges: [entry.user_edited ? t("translation.userEdited") : t("translation.aiTranslated")],
      warnings: PASSPORT_SPELLING_FIELDS.has(fieldKey)
        ? [t("translation.passportSpellingWarning")]
        : [],
      editable: true,
    };
  });

  function handleUpdated(fieldName: string, officialValue: string) {
    setTranslations((prev) => ({
      ...prev,
      [fieldName]: {
        source_text: prev[fieldName]?.source_text ?? "",
        translated_text: officialValue,
        user_edited: true,
      },
    }));
  }

  if (!loading && !error && rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <BilingualReviewPanel
        applicationId={applicationId}
        rows={rows}
        loading={loading}
        error={error}
        retrying={retrying}
        onRetry={() => void retryTranslation()}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
