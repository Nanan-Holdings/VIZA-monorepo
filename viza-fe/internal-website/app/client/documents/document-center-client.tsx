"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Plane,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  confirmPassportOcrExtraction,
  loadDocumentCenterData,
  recordDocumentUpload,
  type ApplicationDocument,
  type DocumentApplication,
  type DocumentCenterData,
  type DocumentRequirement,
  type PassportOcrExtraction,
} from "./actions";

interface DocumentCenterClientProps {
  initialData: DocumentCenterData | null;
  initialError: string | null;
}

interface DocumentViewState {
  requirement: DocumentRequirement;
  document: ApplicationDocument | null;
  status: DocumentStatusView;
}

interface DocumentStatusView {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClassName: string;
  ready: boolean;
  needsUpload: boolean;
}

interface TravelSupportCandidate {
  title: string;
  updatedAt: string | null;
  itinerary: unknown[];
  travelState: Record<string, unknown>;
  citySummary: string;
}

type BusyTarget = { type: "upload" | "ocr" | "travel" | "refresh"; key: string } | null;

const TRAVEL_CHAT_ARCHIVE_VERSION = 1;
const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
  return cleaned.length > 120 ? cleaned.slice(cleaned.length - 120) : cleaned;
}

function getRequirementAccept(requirement: DocumentRequirement): string {
  if (requirement.accept.length > 0) return requirement.accept.join(",");
  if (requirement.documentType === "photo") return ".jpg,.jpeg,.png";
  return DEFAULT_ACCEPT;
}

function getDocumentKey(requirement: DocumentRequirement): string {
  return `${requirement.key}:${requirement.documentType}`;
}

function isRejectedStatus(status: string): boolean {
  return ["rejected", "needs_replacement", "replacement_requested", "failed"].includes(status.toLowerCase());
}

function isAcceptedStatus(status: string): boolean {
  return ["validated", "approved", "accepted", "confirmed"].includes(status.toLowerCase());
}

function getDocumentStatus(requirement: DocumentRequirement, document: ApplicationDocument | null): DocumentStatusView {
  if (!document) {
    return {
      label: requirement.required ? "Missing" : "Optional",
      description: requirement.required ? "Required before this package can move forward." : "Add this if it supports your case.",
      icon: requirement.required ? AlertCircle : FileText,
      badgeClassName: requirement.required
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600",
      ready: !requirement.required,
      needsUpload: true,
    };
  }

  if (isRejectedStatus(document.status)) {
    return {
      label: "Needs replacement",
      description: document.rejectionReason ?? document.reviewNotes ?? "VIZA needs a clearer or corrected file.",
      icon: XCircle,
      badgeClassName: "border-red-200 bg-red-50 text-red-700",
      ready: false,
      needsUpload: true,
    };
  }

  if (document.status.toLowerCase() === "missing") {
    return {
      label: "Missing",
      description: "This item was requested but no usable file is on record.",
      icon: AlertCircle,
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      ready: false,
      needsUpload: true,
    };
  }

  if (isAcceptedStatus(document.status)) {
    return {
      label: "Accepted",
      description: "Checked and accepted for this application packet.",
      icon: CheckCircle2,
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      ready: true,
      needsUpload: false,
    };
  }

  return {
    label: "Uploaded",
    description: "Received and waiting for review.",
    icon: Clock3,
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    ready: true,
    needsUpload: false,
  };
}

function findDocumentForRequirement(documents: ApplicationDocument[], requirement: DocumentRequirement) {
  return (
    documents.find((document) => document.requirementKey === requirement.key) ??
    documents.find((document) => document.documentType === requirement.documentType) ??
    documents.find((document) => document.documentType === requirement.key) ??
    null
  );
}

function buildDocumentViews(data: DocumentCenterData): DocumentViewState[] {
  return data.requirements.map((requirement) => {
    const document = findDocumentForRequirement(data.documents, requirement);
    return {
      requirement,
      document,
      status: getDocumentStatus(requirement, document),
    };
  });
}

function getLatestPassportOcr(extractions: PassportOcrExtraction[]): PassportOcrExtraction | null {
  return extractions[0] ?? null;
}

function getOcrDisplayFields(extraction: PassportOcrExtraction | null) {
  if (!extraction) return [];
  const labels: Array<[string, string[]]> = [
    ["Full name", ["full_name", "name", "passport_full_name", "holder_name"]],
    ["Passport number", ["passport_number", "document_number", "passport_no"]],
    ["Date of birth", ["date_of_birth", "birth_date", "dob"]],
    ["Nationality", ["nationality", "citizenship"]],
    ["Issuing country", ["passport_issuing_country", "issuing_country", "country_of_issue"]],
    ["Issue date", ["passport_issue_date", "issue_date", "date_of_issue"]],
    ["Expiry date", ["passport_expiry_date", "expiry_date", "expiration_date", "date_of_expiry"]],
  ];

  return labels
    .map(([label, keys]) => {
      for (const key of keys) {
        const value = extraction.extractedFields[key];
        if (typeof value === "string" && value.trim()) return { label, value: value.trim() };
        if (isRecord(value)) {
          const nested = getString(value, "value") ?? getString(value, "text") ?? getString(value, "raw");
          if (nested) return { label, value: nested };
        }
      }
      return null;
    })
    .filter((field): field is { label: string; value: string } => Boolean(field));
}

function getTravelArchiveKey(applicationId: string): string {
  return `viza:travel-chat:${TRAVEL_CHAT_ARCHIVE_VERSION}:${applicationId}`;
}

function getCitiesFromTravelState(travelState: Record<string, unknown>): string {
  const order = getArray(travelState.travel_order).filter((item): item is string => typeof item === "string");
  const cities = getArray(travelState.cities).filter((item): item is string => typeof item === "string");
  const source = order.length > 0 ? order : cities;
  if (source.length === 0) return "Travel AI itinerary";
  return source.slice(0, 4).join(" → ");
}

function findItineraryInMessages(messages: unknown[]): unknown[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) continue;
    const parts = getArray(message.parts);
    for (const part of parts) {
      if (!isRecord(part)) continue;
      if (part.type === "tool-itinerary" && Array.isArray(part.output) && part.output.length > 0) {
        return part.output;
      }
    }
  }
  return [];
}

function readTravelSupportCandidate(applicationId: string | null): TravelSupportCandidate | null {
  if (!applicationId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getTravelArchiveKey(applicationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== TRAVEL_CHAT_ARCHIVE_VERSION) return null;

    const sessions = getArray(parsed.sessions).filter(isRecord);
    for (const session of sessions) {
      const versions = getArray(session.versions).filter(isRecord);
      const latestVersion = versions[versions.length - 1];
      if (latestVersion && Array.isArray(latestVersion.itinerary) && latestVersion.itinerary.length > 0) {
        const travelState = isRecord(latestVersion.travelState) ? latestVersion.travelState : {};
        return {
          title: getString(latestVersion, "title") ?? getString(session, "title") ?? "Travel AI itinerary",
          updatedAt: getString(latestVersion, "createdAt") ?? getString(session, "updatedAt"),
          itinerary: latestVersion.itinerary,
          travelState,
          citySummary: getCitiesFromTravelState(travelState),
        };
      }

      const messageItinerary = findItineraryInMessages(getArray(session.messages));
      if (messageItinerary.length > 0) {
        const travelState = isRecord(session.travelState) ? session.travelState : {};
        return {
          title: getString(session, "title") ?? "Travel AI itinerary",
          updatedAt: getString(session, "updatedAt"),
          itinerary: messageItinerary,
          travelState,
          citySummary: getCitiesFromTravelState(travelState),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

function ApplicationSelector({
  applications,
  selectedApplication,
}: {
  applications: DocumentApplication[];
  selectedApplication: DocumentApplication | null;
}) {
  if (applications.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {applications.map((application) => {
        const selected = application.id === selectedApplication?.id;
        return (
          <Link
            key={application.id}
            href={`/client/documents?applicationId=${encodeURIComponent(application.id)}`}
            className={cn(
              "flex min-w-[220px] items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
              selected
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-border bg-white text-foreground hover:border-brand-200",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {application.countryFlag} {application.countryName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{application.visaTypeLabel}</span>
            </span>
            {selected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatusView }) {
  const Icon = status.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", status.badgeClassName)}>
      <Icon className="h-3.5 w-3.5" />
      {status.label}
    </span>
  );
}

function RequirementRow({
  view,
  busy,
  onChooseFile,
  inputRef,
  onFileChange,
}: {
  view: DocumentViewState;
  busy: boolean;
  onChooseFile: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const { requirement, document, status } = view;
  const Icon = requirement.documentType === "photo" ? Camera : requirement.documentType === "travel_itinerary" ? Plane : FileText;

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{requirement.labelEn}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {requirement.required ? "Required" : "Optional"}
              </span>
            </div>
            <p className="text-sm font-medium text-brand-600">{requirement.labelZh}</p>
            {requirement.description && <p className="max-w-2xl text-sm text-muted-foreground">{requirement.description}</p>}
            {document?.filename && (
              <p className="text-xs text-muted-foreground">
                File on record: <span className="font-medium text-foreground">{document.filename}</span>
              </p>
            )}
            {document?.reviewNotes && <p className="text-xs text-muted-foreground">Review note: {document.reviewNotes}</p>}
            {status.needsUpload && status.description && (
              <p className={cn("text-xs", isRejectedStatus(document?.status ?? "") ? "text-red-700" : "text-amber-800")}>
                {status.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <StatusBadge status={status} />
          <Button
            type="button"
            variant={document ? "outline" : "default"}
            className={cn(!document && "bg-brand-500 hover:bg-brand-400")}
            onClick={onChooseFile}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : document ? <RefreshCw className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
            {document ? "Re-upload" : "Upload"}
          </Button>
          <input ref={inputRef} type="file" className="hidden" accept={getRequirementAccept(requirement)} onChange={onFileChange} />
        </div>
      </div>
    </div>
  );
}

function PhotoCompliancePanel({ photoView, onReupload }: { photoView: DocumentViewState | null; onReupload: () => void }) {
  const document = photoView?.document ?? null;
  const status = photoView?.status ?? null;
  const failed = Boolean(document && isRejectedStatus(document.status));
  const passed = Boolean(document && isAcceptedStatus(document.status));
  const pending = Boolean(document && !failed && !passed);
  const missing = !document;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">Photo Compliance</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            VIZA keeps the photo state separate from the rest of the checklist so a failed photo is easy to fix.
          </p>
          {failed && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {document?.rejectionReason ?? document?.reviewNotes ?? "The photo did not meet the destination requirements. Please upload a new one."}
            </p>
          )}
          {pending && <p className="text-sm text-blue-700">Photo received. VIZA still needs to confirm it meets the destination rules.</p>}
          {passed && <p className="text-sm text-emerald-700">Photo passed review and is ready for the application packet.</p>}
          {missing && <p className="text-sm text-amber-800">No passport-style photo has been uploaded yet.</p>}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusBadge
            status={
              status ?? {
                label: "Missing",
                description: "No photo uploaded",
                icon: AlertCircle,
                badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
                ready: false,
                needsUpload: true,
              }
            }
          />
          <Button type="button" variant="outline" onClick={onReupload}>
            <RefreshCw className="h-4 w-4" />
            {document ? "Replace photo" : "Upload photo"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function OcrPanel({
  passportView,
  extraction,
  busy,
  onConfirm,
}: {
  passportView: DocumentViewState | null;
  extraction: PassportOcrExtraction | null;
  busy: boolean;
  onConfirm: () => void;
}) {
  const fields = getOcrDisplayFields(extraction);
  const hasPassport = Boolean(passportView?.document);
  const confirmed = Boolean(extraction?.confirmedAt || extraction?.status.toLowerCase() === "confirmed");
  const failed = Boolean(extraction && ["failed", "error", "rejected"].includes(extraction.status.toLowerCase()));
  const pending = Boolean(extraction && ["pending", "processing", "running"].includes(extraction.status.toLowerCase()));

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">Passport OCR Confirmation</h2>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Extracted passport details stay as proposed values until you confirm them. Confirmation updates your profile and application answers.
          </p>
          {!hasPassport && <p className="text-sm text-amber-800">Upload a passport bio page before OCR confirmation can be used.</p>}
          {hasPassport && !extraction && <p className="text-sm text-muted-foreground">No OCR extraction has been recorded for this passport yet.</p>}
          {pending && <p className="text-sm text-blue-700">OCR is in progress. Refresh this page after the extraction finishes.</p>}
          {failed && <p className="text-sm text-red-700">{extraction?.errorMessage ?? "OCR could not read the passport clearly."}</p>}
          {confirmed && <p className="text-sm text-emerald-700">Passport fields were confirmed by the applicant.</p>}
        </div>

        {fields.length > 0 && (
          <div className="w-full rounded-lg border border-border bg-muted/30 p-4 lg:max-w-md">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Proposed fields</p>
              {confirmed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Confirmed
                </span>
              )}
            </div>
            <dl className="space-y-2">
              {fields.map((field) => (
                <div key={field.label} className="grid grid-cols-[120px_1fr] gap-3 text-sm">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="font-medium text-foreground">{field.value}</dd>
                </div>
              ))}
            </dl>
            {!confirmed && (
              <Button type="button" className="mt-4 w-full bg-brand-500 hover:bg-brand-400" onClick={onConfirm} disabled={busy || pending || failed}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Confirm passport details
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function TravelAiPanel({
  candidate,
  requirement,
  existingDocument,
  busy,
  onSave,
}: {
  candidate: TravelSupportCandidate | null;
  requirement: DocumentRequirement | null;
  existingDocument: ApplicationDocument | null;
  busy: boolean;
  onSave: () => void;
}) {
  if (!requirement) return null;

  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-brand-500" />
            <h2 className="text-lg font-semibold">Travel AI Supporting Document</h2>
          </div>
          {candidate ? (
            <>
              <p className="text-sm text-muted-foreground">
                A Travel AI itinerary is available in this browser and can be saved as the travel itinerary document.
              </p>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <span className="font-semibold">{candidate.title}</span>
                <span className="block">{candidate.citySummary}</span>
                <span className="block text-xs">Updated {formatDate(candidate.updatedAt)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved Travel AI itinerary was found for this application in this browser. Generate one from Travel AI when you want it to satisfy this checklist item.
            </p>
          )}
          {existingDocument && (
            <p className="text-xs text-muted-foreground">
              Current travel itinerary on record: <span className="font-medium text-foreground">{existingDocument.filename}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {candidate && (
            <Button type="button" className="bg-brand-500 hover:bg-brand-400" onClick={onSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              {existingDocument ? "Replace with Travel AI" : "Save Travel AI itinerary"}
            </Button>
          )}
          <Button asChild type="button" variant="outline">
            <Link href="/client/travel-chat">
              <ExternalLink className="h-4 w-4" />
              Open Travel AI
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
        <FileText className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Document Checklist Center</h1>
        <p className="text-muted-foreground">
          {error ?? "Start or reopen an application first. VIZA will build a package-aware checklist once an application exists."}
        </p>
      </div>
      <Button asChild className="bg-brand-500 hover:bg-brand-400">
        <Link href="/client/application">
          Go to application
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </main>
  );
}

export function DocumentCenterClient({ initialData, initialError }: DocumentCenterClientProps) {
  const [data, setData] = useState<DocumentCenterData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [busyTarget, setBusyTarget] = useState<BusyTarget>(null);
  const [travelCandidate, setTravelCandidate] = useState<TravelSupportCandidate | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedApplication = data?.selectedApplication ?? null;
  const documentViews = useMemo(() => (data ? buildDocumentViews(data) : []), [data]);
  const requiredViews = documentViews.filter((view) => view.requirement.required);
  const optionalViews = documentViews.filter((view) => !view.requirement.required);
  const blockingViews = requiredViews.filter((view) => !view.status.ready);
  const passportView =
    documentViews.find((view) => view.requirement.documentType === "passport_copy" || view.requirement.key === "passport_copy") ?? null;
  const photoView = documentViews.find((view) => view.requirement.documentType === "photo" || view.requirement.key === "photo") ?? null;
  const travelView =
    documentViews.find((view) => view.requirement.documentType === "travel_itinerary" || view.requirement.key === "travel_itinerary") ?? null;
  const latestOcr = getLatestPassportOcr(data?.ocrExtractions ?? []);
  const totalRequired = requiredViews.length;
  const readyRequired = requiredViews.filter((view) => view.status.ready).length;
  const completionPercent = totalRequired > 0 ? Math.round((readyRequired / totalRequired) * 100) : 0;

  useEffect(() => {
    setTravelCandidate(readTravelSupportCandidate(selectedApplication?.id ?? null));
  }, [selectedApplication?.id]);

  async function refreshData() {
    if (!selectedApplication) return;
    setBusyTarget({ type: "refresh", key: selectedApplication.id });
    const result = await loadDocumentCenterData({ applicationId: selectedApplication.id });
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setBusyTarget(null);
  }

  async function uploadFile(requirement: DocumentRequirement, file: File, source: "manual_upload" | "travel_ai" = "manual_upload") {
    if (!selectedApplication) return;
    const key = getDocumentKey(requirement);
    setBusyTarget({ type: source === "travel_ai" ? "travel" : "upload", key });
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("A signed-in Supabase session is required to upload documents.");

      const safeName = sanitizeFilename(file.name);
      const storagePath = `${user.id}/${selectedApplication.id}/${requirement.documentType}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("application-documents")
        .upload(storagePath, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const result = await recordDocumentUpload({
        applicationId: selectedApplication.id,
        documentType: requirement.documentType,
        requirementKey: requirement.key,
        filename: safeName,
        storagePath,
        required: requirement.required,
        source,
      });

      if (!result.ok) throw new Error(result.error);
      await refreshData();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed.");
      setBusyTarget(null);
    }
  }

  async function handleFileChange(requirement: DocumentRequirement, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(requirement, file);
  }

  async function handleConfirmOcr() {
    if (!selectedApplication || !latestOcr) return;
    setBusyTarget({ type: "ocr", key: latestOcr.id });
    const result = await confirmPassportOcrExtraction({
      applicationId: selectedApplication.id,
      extractionId: latestOcr.id,
    });

    if (result.ok) {
      await refreshData();
    } else {
      setError(result.error);
      setBusyTarget(null);
    }
  }

  async function handleSaveTravelAi() {
    if (!selectedApplication || !travelCandidate || !travelView) return;
    const exportedAt = new Date().toISOString();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            source: "viza_travel_ai",
            applicationId: selectedApplication.id,
            title: travelCandidate.title,
            exportedAt,
            travelState: travelCandidate.travelState,
            itinerary: travelCandidate.itinerary,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const file = new File([blob], `travel-ai-itinerary-${exportedAt.slice(0, 10)}.json`, { type: "application/json" });
    await uploadFile(travelView.requirement, file, "travel_ai");
  }

  if (!data || !selectedApplication) {
    return <EmptyState error={error} />;
  }

  const refreshing = busyTarget?.type === "refresh";

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-16">
      <section className="space-y-5">
        <ApplicationSelector applications={data.applications} selectedApplication={selectedApplication} />

        <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-normal text-brand-500">Document checklist center</p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-foreground">
                  {selectedApplication.countryFlag} {selectedApplication.countryName} documents
                </h1>
                <p className="max-w-3xl text-muted-foreground">
                  {data.packageSummary?.name ?? selectedApplication.visaTypeLabel} uses a package-aware checklist with required blockers separated from optional supporting evidence.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{selectedApplication.visaTypeLabel}</span>
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Application status: {selectedApplication.status}</span>
                <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  Checklist source: {data.packageSummary?.source.replace("_", " ") ?? "fallback"}
                </span>
              </div>
            </div>

            <div className="w-full rounded-lg border border-border bg-muted/30 p-4 lg:max-w-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">Readiness</span>
                <span className="text-2xl font-semibold text-brand-500">{completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {readyRequired} of {totalRequired} required documents are uploaded or accepted.
              </p>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/client/status">
                    View status
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={refreshData} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <section className={cn("rounded-lg border p-5 shadow-sm", blockingViews.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {blockingViews.length ? <AlertCircle className="h-5 w-5 text-amber-700" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
              <h2 className={cn("text-lg font-semibold", blockingViews.length ? "text-amber-900" : "text-emerald-900")}>
                {blockingViews.length ? "Missing or replacement items" : "Required checklist ready"}
              </h2>
            </div>
            <p className={cn("mt-1 text-sm", blockingViews.length ? "text-amber-800" : "text-emerald-800")}>
              {blockingViews.length
                ? "These required items block the document packet until uploaded or replaced."
                : "All required items have an uploaded or accepted file. VIZA can continue document review."}
            </p>
          </div>
          {blockingViews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockingViews.map((view) => (
                <span key={getDocumentKey(view.requirement)} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                  {view.requirement.labelEn}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Required documents</h2>
              <span className="text-sm text-muted-foreground">{requiredViews.length} items</span>
            </div>
            <div className="space-y-3">
              {requiredViews.map((view) => {
                const key = getDocumentKey(view.requirement);
                return (
                  <RequirementRow
                    key={key}
                    view={view}
                    busy={busyTarget?.type === "upload" && busyTarget.key === key}
                    inputRef={(element) => {
                      fileInputs.current[key] = element;
                    }}
                    onChooseFile={() => fileInputs.current[key]?.click()}
                    onFileChange={(event) => handleFileChange(view.requirement, event)}
                  />
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Optional supporting evidence</h2>
              <span className="text-sm text-muted-foreground">{optionalViews.length} items</span>
            </div>
            {optionalViews.length > 0 ? (
              <div className="space-y-3">
                {optionalViews.map((view) => {
                  const key = getDocumentKey(view.requirement);
                  return (
                    <RequirementRow
                      key={key}
                      view={view}
                      busy={busyTarget?.type === "upload" && busyTarget.key === key}
                      inputRef={(element) => {
                        fileInputs.current[key] = element;
                      }}
                      onChooseFile={() => fileInputs.current[key]?.click()}
                      onFileChange={(event) => handleFileChange(view.requirement, event)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                This visa package has no optional documents configured yet.
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <PhotoCompliancePanel
            photoView={photoView}
            onReupload={() => {
              if (!photoView) return;
              fileInputs.current[getDocumentKey(photoView.requirement)]?.click();
            }}
          />
          <OcrPanel
            passportView={passportView}
            extraction={latestOcr}
            busy={busyTarget?.type === "ocr"}
            onConfirm={handleConfirmOcr}
          />
          <TravelAiPanel
            candidate={travelCandidate}
            requirement={travelView?.requirement ?? null}
            existingDocument={travelView?.document ?? null}
            busy={busyTarget?.type === "travel"}
            onSave={handleSaveTravelAi}
          />
        </aside>
      </div>
    </main>
  );
}
