"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, ScanLine, Upload, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordDocumentUpload } from "@/app/client/documents/actions";
import { createClient } from "@/lib/supabase/client";
import type { SimplifiedIdentity, SimplifiedPassport } from "./types";

type Screen = "upload" | "extracting" | "result" | "error";

interface ExtractionResult {
  surname?: string;
  givenNames?: string;
  dob?: string;
  sex?: "Male" | "Female" | "";
  nationality?: string;
  cityOfBirth?: string;
  countryOfBirth?: string;
  passportNumber?: string;
  passportType?: SimplifiedPassport["type"];
  issuingCountry?: string;
  issuanceCity?: string;
  issuanceProvince?: string;
  issueDate?: string;
  expiryDate?: string;
  confidence?: "high" | "medium" | "low";
  warnings?: string[];
}

export interface StepIdentityScanProps {
  applicationId: string | null;
  onExtracted: (
    identity: Partial<SimplifiedIdentity>,
    passport: Partial<SimplifiedPassport>,
  ) => void;
  onCancel: () => void;
  onFallbackManual: () => void;
}

const STORAGE_BUCKET = "application-documents";

export function StepIdentityScan({
  applicationId,
  onExtracted,
  onCancel,
  onFallbackManual,
}: StepIdentityScanProps) {
  const t = useTranslations("simplifiedForm.identity");
  const tCommon = useTranslations("simplifiedForm.common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<Screen>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!applicationId) {
      setErrorMsg(t("scanNoDraft"));
      setScreen("error");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("scanWrongFormat"));
      setScreen("error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg(t("scanTooLarge"));
      setScreen("error");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScreen("extracting");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("scanNotAuthenticated"));

      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/${applicationId}/passport_scan/scan.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const recordResult = await recordDocumentUpload({
        applicationId,
        documentType: "passport_scan",
        requirementKey: "passport_copy",
        filename: file.name || `passport.${ext}`,
        storagePath: path,
        required: true,
      });
      if (!recordResult.ok) throw new Error(recordResult.error);

      const resp = await fetch("/api/passport-scan/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, storagePath: path, mediaType: file.type }),
      });
      const payload = (await resp.json()) as { extracted?: ExtractionResult; error?: string };
      if (!resp.ok || !payload.extracted) {
        throw new Error(payload.error || t("scanExtractError"));
      }
      setExtracted(payload.extracted);
      setScreen("result");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("scanExtractError"));
      setScreen("error");
    }
  };

  const handleConfirm = () => {
    if (!extracted) return;
    const identity: Partial<SimplifiedIdentity> = {};
    const passport: Partial<SimplifiedPassport> = {};
    if (extracted.givenNames) identity.firstName = extracted.givenNames;
    if (extracted.surname) identity.lastName = extracted.surname;
    if (extracted.dob) identity.dob = extracted.dob;
    if (extracted.sex === "Male" || extracted.sex === "Female") identity.gender = extracted.sex;
    if (extracted.nationality) identity.nationality = extracted.nationality;
    if (extracted.cityOfBirth) identity.cityOfBirth = extracted.cityOfBirth;
    if (extracted.countryOfBirth) identity.countryOfBirth = extracted.countryOfBirth;
    if (extracted.passportNumber) passport.number = extracted.passportNumber;
    if (extracted.passportType) passport.type = extracted.passportType;
    if (extracted.issuingCountry) passport.issuingCountry = extracted.issuingCountry;
    if (extracted.issuanceCity) passport.issuanceCity = extracted.issuanceCity;
    if (extracted.issuanceProvince) passport.issuanceProvince = extracted.issuanceProvince;
    if (extracted.issueDate) passport.issueDate = extracted.issueDate;
    if (extracted.expiryDate) passport.expiryDate = extracted.expiryDate;
    onExtracted(identity, passport);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtracted(null);
    setErrorMsg(null);
    setScreen("upload");
  };

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (screen === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-10">
        <div className="relative h-16 w-16">
          <Loader2 className="h-16 w-16 animate-spin text-brand-500" />
          <ScanLine className="absolute inset-0 m-auto h-7 w-7 text-brand-500" />
        </div>
        <p className="text-base font-medium text-foreground">{t("scanExtracting")}</p>
        {previewUrl ? (
          <div className="w-40 overflow-hidden rounded-lg border border-input">
            <img src={previewUrl} alt="Passport preview" className="w-full" />
          </div>
        ) : null}
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{errorMsg ?? t("scanExtractError")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reset}>
            {t("scanRetry")}
          </Button>
          <Button variant="ghost" onClick={onFallbackManual}>
            {t("scanFallbackManual")}
          </Button>
        </div>
      </div>
    );
  }

  if (screen === "result" && extracted) {
    const rows: Array<[string, string | undefined]> = [
      [t("firstName"), extracted.givenNames],
      [t("lastName"), extracted.surname],
      [t("dateOfBirth"), extracted.dob],
      [t("gender"), extracted.sex],
      [t("nationality"), extracted.nationality],
      [t("countryOfBirth"), extracted.countryOfBirth],
      [t("cityOfBirth"), extracted.cityOfBirth],
      [t("scanPassportNumber"), extracted.passportNumber],
      [t("scanPassportType"), extracted.passportType],
      [t("scanIssuingCountry"), extracted.issuingCountry],
      [t("scanIssueDate"), extracted.issueDate],
      [t("scanExpiryDate"), extracted.expiryDate],
    ];

    const confColor =
      extracted.confidence === "high"
        ? "text-emerald-600 border-emerald-200 bg-emerald-50"
        : extracted.confidence === "medium"
          ? "text-amber-700 border-amber-200 bg-amber-50"
          : "text-rose-700 border-rose-200 bg-rose-50";

    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("scanResultTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("scanResultSubtitle")}</p>
        </header>

        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${confColor}`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t(`scanConfidence.${extracted.confidence ?? "medium"}` as never)}
        </div>

        {extracted.warnings && extracted.warnings.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">{t("scanWarningsTitle")}</p>
            <ul className="mt-1 list-disc pl-5">
              {extracted.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[160px,1fr]">
          {previewUrl ? (
            <div className="overflow-hidden rounded-lg border border-input">
              <img src={previewUrl} alt="Passport preview" className="w-full" />
            </div>
          ) : null}
          <dl className="divide-y divide-border rounded-xl border border-input">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfirm} size="lg">
            {t("scanUseDetails")}
          </Button>
          <Button variant="outline" onClick={reset}>
            {t("scanRetry")}
          </Button>
          <Button variant="ghost" onClick={onFallbackManual}>
            {t("scanFallbackManual")}
          </Button>
        </div>
      </div>
    );
  }

  // screen === "upload"
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("scanUploadTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("scanInstructions")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={tCommon("back")}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex flex-col items-start gap-3 rounded-xl border border-input bg-white p-5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 group-hover:bg-white">
            <Upload className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-foreground">{t("scanBrowse")}</span>
            <span className="text-xs text-muted-foreground">{t("scanBrowseHint")}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="group flex flex-col items-start gap-3 rounded-xl border border-input bg-white p-5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 group-hover:bg-white">
            <Camera className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold text-foreground">{t("scanTakePhoto")}</span>
            <span className="text-xs text-muted-foreground">{t("scanTakePhotoHint")}</span>
          </div>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPickerChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPickerChange}
      />

      <p className="text-xs text-muted-foreground">{t("scanPrivacyNote")}</p>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onFallbackManual}>
          {t("scanFallbackManual")}
        </Button>
      </div>
    </div>
  );
}
