"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Ban,
  Camera,
  Check,
  CheckCircle2,
  FileImage,
  Loader2,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmPassportOcrExtraction } from "@/app/client/documents/actions";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import { cn } from "@/lib/utils";
import type { SimplifiedIdentity, SimplifiedPassport } from "./types";

type Screen = "upload" | "extracting" | "result" | "error";
type ScanStage = "reading" | "extracting" | "verifying";

interface PassportOcrFieldProposal {
  value: string | null;
  confidence: number | null;
}

interface PassportOcrResponse {
  success: boolean;
  extractionId?: string | null;
  confidence?: number;
  warnings?: string[];
  proposedFields?: {
    fullName: PassportOcrFieldProposal;
    nativeFullName?: PassportOcrFieldProposal;
    givenNames: PassportOcrFieldProposal;
    surname: PassportOcrFieldProposal;
    passportNumber: PassportOcrFieldProposal;
    dateOfBirth: PassportOcrFieldProposal;
    placeOfBirth?: PassportOcrFieldProposal;
    nationality: PassportOcrFieldProposal;
    issuingCountry: PassportOcrFieldProposal;
    issueDate: PassportOcrFieldProposal;
    expiryDate: PassportOcrFieldProposal;
    gender: PassportOcrFieldProposal;
  };
  error?: {
    message?: string;
  };
}

interface ExtractionResult {
  surname?: string;
  givenNames?: string;
  nativeFullName?: string;
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
  extractionId?: string | null;
  storagePath?: string;
  filename?: string;
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

const SCAN_STAGES: ScanStage[] = ["reading", "extracting", "verifying"];

function valueOf(field: PassportOcrFieldProposal | undefined): string | undefined {
  const value = field?.value?.trim();
  return value || undefined;
}

function confidenceLevel(value: number | undefined): ExtractionResult["confidence"] {
  if (typeof value !== "number") return "medium";
  if (value >= 0.86) return "high";
  if (value >= 0.62) return "medium";
  return "low";
}

function genderFromOcr(value: string | undefined): ExtractionResult["sex"] {
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return "";
}

function extractionFromPassportOcr(payload: PassportOcrResponse): ExtractionResult {
  const fields = payload.proposedFields;
  if (!fields) return {};

  return {
    surname: valueOf(fields.surname),
    givenNames: valueOf(fields.givenNames),
    nativeFullName: valueOf(fields.nativeFullName),
    dob: valueOf(fields.dateOfBirth),
    sex: genderFromOcr(valueOf(fields.gender)),
    nationality: valueOf(fields.nationality),
    cityOfBirth: valueOf(fields.placeOfBirth),
    passportNumber: valueOf(fields.passportNumber),
    issuingCountry: valueOf(fields.issuingCountry),
    issueDate: valueOf(fields.issueDate),
    expiryDate: valueOf(fields.expiryDate),
    confidence: confidenceLevel(payload.confidence),
    warnings: payload.warnings,
  };
}

function extensionFromFile(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension) return nameExtension;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function isSupportedFile(file: File) {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function ScanDocumentPreview() {
  return (
    <div className="relative h-[116px] w-[180px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#1a2849] to-[#0d1729] shadow-[0_4px_8px_rgba(3,52,110,0.10),0_18px_28px_-14px_rgba(3,52,110,0.32)]">
      <div className="absolute inset-[10px] rounded-lg bg-gradient-to-br from-[#4172b8] to-[#1e3a6b] p-3">
        <span className="mb-1 block h-1 w-4/5 rounded-full bg-white/40" />
        <span className="mb-1 block h-1 w-3/5 rounded-full bg-white/40" />
        <span className="mb-3 block h-1 w-[70%] rounded-full bg-white/40" />
        <span className="mb-1 block h-1 w-[45%] rounded-full bg-white/40" />
        <span className="block h-1 w-3/4 rounded-full bg-white/40" />
        <span className="absolute right-5 top-5 h-[30px] w-6 rounded bg-white/20" />
      </div>
      <span className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-90 shadow-[0_0_12px_rgba(125,211,252,0.9)] motion-safe:animate-passport-scan motion-reduce:top-1/2" />
    </div>
  );
}

function ScanProgressPanel({
  stage,
  labels,
}: {
  stage: ScanStage;
  labels: Record<ScanStage, string>;
}) {
  const activeIndex = SCAN_STAGES.indexOf(stage);

  return (
    <div className="grid gap-8 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/60 to-brand-100/70 p-6 sm:grid-cols-[180px,1fr] sm:items-center">
      <ScanDocumentPreview />
      <div className="flex min-w-0 flex-col gap-3">
        {SCAN_STAGES.map((item, index) => {
          const done = activeIndex > index;
          const active = activeIndex === index;

          return (
            <div key={item} className="flex items-center gap-4">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  done && "bg-brand-500 text-white",
                  active && "bg-brand-100 text-brand-500",
                  !done && !active && "bg-slate-200 text-transparent",
                )}
              >
                {done ? (
                  <Check className="h-5 w-5" strokeWidth={3} />
                ) : active ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                ) : (
                  <Check className="h-5 w-5" strokeWidth={3} />
                )}
              </span>
              <span
                className={cn(
                  "text-base font-medium sm:text-lg",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {labels[item]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [scanStage, setScanStage] = useState<ScanStage>("reading");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const scanLabels = {
    reading: t("scanReadingDocument"),
    extracting: t("scanExtractingDetails"),
    verifying: t("scanVerifyingAuthenticity"),
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!applicationId) {
      setErrorMsg(t("scanNoDraft"));
      setScreen("error");
      return;
    }
    if (!isSupportedFile(file)) {
      setErrorMsg(t("scanWrongFormat"));
      setScreen("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(t("scanTooLarge"));
      setScreen("error");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreviewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPreviewUrl(nextPreviewUrl);
    setScanStage("reading");
    setScreen("extracting");

    try {
      const ext = extensionFromFile(file);
      const uploadForm = new FormData();
      uploadForm.set("applicationId", applicationId);
      uploadForm.set("documentType", "passport_copy");
      uploadForm.set("requirementKey", "passport_copy");
      uploadForm.set("filename", file.name || `passport.${ext}`);
      uploadForm.set("required", "true");
      uploadForm.set("file", file);
      const uploadResult = await uploadApplicationDocumentFromClient(uploadForm);
      if (!uploadResult.ok) throw new Error(uploadResult.error);

      setScanStage("extracting");
      const resp = await fetch("/api/passport-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, storagePath: uploadResult.storagePath }),
      });
      const payload = (await resp.json().catch(() => null)) as PassportOcrResponse | null;
      if (!resp.ok || !payload?.success || !payload.proposedFields) {
        throw new Error(payload?.error?.message || t("scanExtractError"));
      }

      setScanStage("verifying");
      setExtracted({
        ...extractionFromPassportOcr(payload),
        extractionId: payload.extractionId,
        storagePath: uploadResult.storagePath,
        filename: uploadResult.filename,
      });
      setScreen("result");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("scanExtractError"));
      setScreen("error");
    }
  };

  const handleConfirm = async () => {
    if (!extracted) return;
    setIsConfirming(true);
    setErrorMsg(null);
    const identity: Partial<SimplifiedIdentity> = {};
    const passport: Partial<SimplifiedPassport> = {};
    if (extracted.givenNames) identity.firstName = extracted.givenNames;
    if (extracted.surname) identity.lastName = extracted.surname;
    if (extracted.nativeFullName) {
      identity.hasNativeAlphabetName = true;
      identity.nativeAlphabetName = extracted.nativeFullName;
    }
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

    try {
      if (applicationId && extracted.extractionId) {
        const confirmResult = await confirmPassportOcrExtraction({
          applicationId,
          extractionId: extracted.extractionId,
        });
        if (!confirmResult.ok) throw new Error(confirmResult.error);
      }
      onExtracted(identity, passport);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("scanExtractError"));
      setScreen("error");
    } finally {
      setIsConfirming(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtracted(null);
    setErrorMsg(null);
    setIsDragging(false);
    setScanStage("reading");
    setScreen("upload");
  };

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  if (screen === "extracting") {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              {t("scanUploadTitle")}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              {t("scanAutoReadSubtitle")}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label={tCommon("back")}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <ScanProgressPanel stage={scanStage} labels={scanLabels} />

        {previewUrl ? (
          <div className="w-40 overflow-hidden rounded-lg border border-input">
            <img src={previewUrl} alt={t("scanPreviewAlt")} className="w-full" />
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
      [t("nativeAlphabetName"), extracted.nativeFullName],
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
              <img src={previewUrl} alt={t("scanPreviewAlt")} className="w-full" />
            </div>
          ) : null}
          <dl className="divide-y divide-border rounded-xl border border-input">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value || "-"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleConfirm} size="lg" disabled={isConfirming}>
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("scanSaving")}
              </>
            ) : (
              t("scanUseDetails")
            )}
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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {t("scanUploadTitle")}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            {t("scanAutoReadSubtitle")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={tCommon("back")}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="inline-flex w-fit rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-brand-500 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Upload className="h-4 w-4" />
          {t("scanUploadFile")}
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-brand-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Camera className="h-4 w-4" />
          {t("scanTakePhoto")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex min-h-[260px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gradient-to-b from-slate-50 to-slate-100 px-6 py-12 text-center transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isDragging ? "border-brand-500 from-brand-50 to-brand-100" : "border-slate-300 hover:border-brand-500 hover:from-brand-50 hover:to-brand-100",
        )}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white text-brand-500 shadow-sm">
          <FileImage className="h-7 w-7" />
        </span>
        <span className="mt-5 text-lg font-medium text-foreground">{t("scanDropTitle")}</span>
        <span className="mt-2 text-sm text-muted-foreground">{t("scanDropSubtitle")}</span>
        <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-medium text-white">
          <Upload className="h-4 w-4" />
          {t("scanBrowse")}
        </span>
        <span className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="rounded border bg-white px-2 py-1 font-medium">JPG</span>
          <span className="rounded border bg-white px-2 py-1 font-medium">PNG</span>
          <span className="rounded border bg-white px-2 py-1 font-medium">WebP</span>
          <span className="rounded border bg-white px-2 py-1 font-medium">PDF</span>
          <span>{t("scanFormatsLimit")}</span>
        </span>
      </button>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{t("scanTipCornersTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("scanTipCornersBody")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Sun className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{t("scanTipLightTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("scanTipLightBody")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <Ban className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{t("scanTipGlareTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("scanTipGlareBody")}</p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-brand-500" />
          {t("scanPrivacyNote")}
        </p>
        <Button variant="ghost" onClick={onFallbackManual}>
          {t("scanFallbackManual")}
        </Button>
      </div>
    </div>
  );
}
