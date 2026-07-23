"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { BrandActionButton } from "@/components/client/brand-action-button";
import { BrandField } from "@/components/client/brand-field";
import { reuseUniversalProfileDocument } from "@/app/client/documents/actions";
import { uploadApplicationDocumentFromClient } from "@/lib/document-upload-client";
import {
  approveJapanAppointmentFinal,
  bookJapanAppointmentSlot,
  cancelJapanAppointmentJob,
  checkJapanAppointmentPortal,
  createJapanAppointmentJob,
  getJapanAppointmentStatus,
  JapanAppointmentApiError,
  recordJapanAppointmentConsent,
  selectJapanAppointmentSlot,
} from "@/lib/japan-appointment-client";
import {
  getJapanVfsChecklist,
  getJapanVfsEligibility,
  JAPAN_VFS_SG_OFFICIAL_URL,
  type JapanApplicantOccupation,
  type JapanVisaRequestType,
  type SingaporePassType,
} from "@/lib/japan-vfs-sg";
import {
  getJapanAppointmentStage,
  type JapanAppointmentSnapshot,
  type JapanAppointmentStage,
} from "@/types/japan-appointment";

interface Props { applicationId: string }
type Busy = "load" | "photo" | "create" | "check" | "select" | "approve" | "book" | "cancel" | null;

const SELECT_CLASS = "h-12 w-full rounded-lg border border-input bg-white px-3 text-[15px] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export function JapanVfsAppointmentAssistant({ applicationId }: Props) {
  const t = useTranslations("JapanAppointment");
  const locale = useLocale();
  const [visaType, setVisaType] = useState<JapanVisaRequestType>("single_entry");
  const [occupation, setOccupation] = useState<JapanApplicantOccupation>("employed");
  const [passType, setPassType] = useState<SingaporePassType | "">("");
  const [passExpiry, setPassExpiry] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [finalApproved, setFinalApproved] = useState(false);
  const [snapshot, setSnapshot] = useState<JapanAppointmentSnapshot | null>(null);
  const [busy, setBusy] = useState<Busy>("load");
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const eligibility = getJapanVfsEligibility({
    nationality: "China",
    passportType: "ordinary",
    singaporePassType: passType,
    singaporePassExpiryDate: passExpiry,
    intendedReturnDate: returnDate,
  });
  const checklist = useMemo(() => getJapanVfsChecklist(visaType, occupation), [visaType, occupation]);
  const checklistReady = checklist.every((item) => confirmed.has(item.id));
  const stage = getJapanAppointmentStage(snapshot);
  const job = snapshot?.job ?? null;
  const preflight = snapshot?.preflight;
  const selectedSlot = snapshot?.slots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null;
  const stepOrder: JapanAppointmentStage[] = ["review", "account", "slots", "confirm", "result"];
  const currentStep = stepOrder.indexOf(stage);

  const localizedError = useCallback((cause: unknown, fallback: "load" | "action") => {
    if (!(cause instanceof JapanAppointmentApiError)) return t(`errors.${fallback}`);
    if (cause.code === "missing_required_fields") return t("errors.missingRequiredFields");
    if (cause.code === "consent_required") return t("errors.consentRequired");
    if (cause.code === "appointment_cancelled") return t("errors.cancelled");
    if (cause.code === "japan_runner_unavailable") return t("errors.runnerUnavailable");
    if (cause.code === "slot_required") return t("errors.slotRequired");
    if (cause.code === "payment_authorization_required") return t("errors.paymentRequired");
    if (cause.code === "final_confirmation_required") return t("errors.finalRequired");
    if (cause.code === "session_required" || cause.code === "unauthorized") return t("errors.sessionRequired");
    return t(`errors.${fallback}`);
  }, [t]);

  const load = useCallback(async () => {
    try {
      setSnapshot(await getJapanAppointmentStatus(applicationId));
    } catch (cause) {
      setError(localizedError(cause, "load"));
    } finally {
      setBusy(null);
    }
  }, [applicationId, localizedError]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = async (kind: Exclude<Busy, "load" | null>, run: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await run();
      await load();
    } catch (cause) {
      setError(localizedError(cause, "action"));
      setBusy(null);
    }
  };

  const eligibilityPayload = {
    singaporePassType: passType,
    singaporePassExpiryDate: passExpiry,
    intendedReturnDate: returnDate,
    passportType: "ordinary",
    visaRequestType: visaType,
    occupation,
    checklistConfirmed: [...confirmed],
  };

  const selectProfilePhoto = () => action("photo", async () => {
    const result = await reuseUniversalProfileDocument({
      applicationId,
      documentType: "photo",
      requirementKey: "photo",
      required: true,
    });
    if (!result.ok) throw new Error("profile_photo_not_found");
  });

  const replacePhoto = async (file: File) => {
    await action("photo", async () => {
      if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) throw new Error("unsupported_photo");
      const formData = new FormData();
      formData.set("applicationId", applicationId);
      formData.set("documentType", "photo");
      formData.set("requirementKey", "photo");
      formData.set("filename", file.name);
      formData.set("required", "true");
      formData.set("source", "manual_upload");
      formData.set("scope", "universal_profile");
      formData.set("file", file);
      const result = await uploadApplicationDocumentFromClient(formData);
      if (!result.ok) throw new Error(result.error);
    });
  };

  const startAutomation = () => action("create", async () => {
    if (!preflight?.consentRecorded) {
      await recordJapanAppointmentConsent(applicationId, {
        ...eligibilityPayload,
        acceptedAt: new Date().toISOString(),
        automationMode: "public_recon",
      });
    }
    await createJapanAppointmentJob(applicationId, eligibilityPayload);
  });

  if (busy === "load" && !snapshot) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-brand-600" />{t("loading")}</div>;
  }

  return (
    <main className="mx-auto w-full max-w-[860px] space-y-6 py-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" aria-label={t("back")}>
          <Link href={`/client/application/long-form?country=japan&applicationId=${encodeURIComponent(applicationId)}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-600">{t("eyebrow")}</p>
              <h1 className="font-heading text-3xl font-medium text-foreground">{t("title")}</h1>
            </div>
            <Badge variant={job ? "default" : "secondary"}>{job ? t(`statuses.${job.status}`) : t("statuses.not_started")}</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <ol className="grid grid-cols-5 gap-2" aria-label={t("steps.label")}>
        {stepOrder.map((item, index) => (
          <li key={item} className={`border-t-2 pt-2 text-center text-[11px] sm:text-sm ${index <= currentStep ? "border-brand-600 text-brand-800" : "border-border text-muted-foreground"}`}>
            <span className="mr-1 font-medium">{index + 1}.</span>{t(`steps.${item}`)}
          </li>
        ))}
      </ol>

      <Alert className="border-brand-100 bg-brand-50">
        <ShieldCheck className="h-4 w-4 text-brand-600" />
        <AlertTitle>{t("free.title")}</AlertTitle>
        <AlertDescription>{t("free.body")}</AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("errors.title")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {snapshot?.account?.accountStatus === "mobile_already_registered" ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle>{t("account.mobileAlreadyRegisteredTitle")}</AlertTitle>
          <AlertDescription>{t("account.mobileAlreadyRegisteredBody")}</AlertDescription>
        </Alert>
      ) : null}

      {stage === "review" && preflight ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-brand-600" />{t("review.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReviewValue label={t("review.englishName")} value={preflight.review.englishName} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.dateOfBirth")} value={preflight.review.dateOfBirth} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.nationality")} value={preflight.review.nationality} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.passport")} value={preflight.review.passportNumber} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.passportExpiry")} value={preflight.review.passportExpiryDate} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.phone")} value={preflight.review.phone} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.email")} value={preflight.review.email} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.address")} value={preflight.review.residentialAddress} fallback={t("review.notProvided")} />
              <ReviewValue label={t("review.center")} value={preflight.review.appointmentCenter} fallback={t("review.notProvided")} icon={<MapPin className="h-4 w-4" />} />
            </div>

            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <BrandField label={t("eligibility.visaType")} htmlFor="jp-visa-type">
                <select id="jp-visa-type" className={SELECT_CLASS} value={visaType} onChange={(event) => setVisaType(event.target.value as JapanVisaRequestType)}>
                  <option value="single_entry">{t("visaTypes.single_entry")}</option>
                  <option value="double_entry">{t("visaTypes.double_entry")}</option>
                  <option value="multiple_entry">{t("visaTypes.multiple_entry")}</option>
                </select>
              </BrandField>
              <BrandField label={t("eligibility.occupation")} htmlFor="jp-occupation">
                <select id="jp-occupation" className={SELECT_CLASS} value={occupation} onChange={(event) => setOccupation(event.target.value as JapanApplicantOccupation)}>
                  {["employed", "self_employed", "student", "retired", "housewife", "unemployed"].map((value) => <option key={value} value={value}>{t(`occupations.${value}`)}</option>)}
                </select>
              </BrandField>
              <BrandField label={t("eligibility.passType")} htmlFor="jp-pass-type">
                <select id="jp-pass-type" className={SELECT_CLASS} value={passType} onChange={(event) => setPassType(event.target.value as SingaporePassType)}>
                  <option value="">{t("select")}</option>
                  {["pr", "employment_pass", "s_pass", "work_permit", "dependent_pass", "long_term_visit_pass", "student_pass"].map((value) => <option key={value} value={value}>{t(`passTypes.${value}`)}</option>)}
                </select>
              </BrandField>
              <BrandField label={t("eligibility.passExpiry")}><DatePicker value={passExpiry} onChange={setPassExpiry} /></BrandField>
              <BrandField label={t("eligibility.returnDate")}><DatePicker value={returnDate} onChange={setReturnDate} /></BrandField>
              <div className="self-end rounded-[8px] border p-3">
                <Badge variant={eligibility.eligible ? "default" : "secondary"}>{eligibility.eligible ? t("eligibility.pass") : t("eligibility.incomplete")}</Badge>
                <p className="mt-2 text-sm text-muted-foreground">{locale === "zh" ? eligibility.reasonZh : t(eligibility.eligible ? "eligibility.passBody" : "eligibility.incompleteBody")}</p>
              </div>
            </div>

            <div className="space-y-3 border-t pt-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <DocumentState label={t("documents.passportStored")} ready={preflight.passportUploaded} yes={t("yes")} no={t("no")} />
                <DocumentState label={t("documents.photoStored")} ready={preflight.photoUploaded} yes={t("yes")} no={t("no")} />
              </div>
              <input ref={photoInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replacePhoto(file); }} />
              <div className="flex flex-wrap gap-2">
                {!preflight.photoUploaded ? <Button type="button" variant="outline" disabled={busy === "photo"} onClick={() => void selectProfilePhoto()}><FileCheck2 className="mr-2 h-4 w-4" />{t("documents.useProfilePhoto")}</Button> : null}
                <Button type="button" variant="outline" disabled={busy === "photo"} onClick={() => photoInputRef.current?.click()}>{busy === "photo" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("documents.replaceProfilePhoto")}</Button>
                <Button variant="outline" asChild><a href={`/client/documents?applicationId=${encodeURIComponent(applicationId)}`}><FileCheck2 className="mr-2 h-4 w-4" />{t("documents.manage")}</a></Button>
              </div>
              {checklist.map((item) => (
                <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[8px] border p-3">
                  <Checkbox checked={confirmed.has(item.id)} onCheckedChange={() => setConfirmed((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} />
                  <span className="font-medium">{locale === "zh" ? item.labelZh : item.labelEn}</span>
                </label>
              ))}
            </div>

            <label className="flex min-h-11 items-start gap-3 rounded-[8px] border p-3 text-sm">
              <Checkbox checked={preflight.consentRecorded || consent} disabled={preflight.consentRecorded} onCheckedChange={(value) => setConsent(value === true)} />
              <span>{t("workflow.consent")}</span>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" asChild><Link href={`/client/application/long-form?country=japan&applicationId=${encodeURIComponent(applicationId)}`}><ArrowLeft className="mr-2 h-4 w-4" />{t("review.edit")}</Link></Button>
              <BrandActionButton
                loading={busy === "create"}
                loadingText={t("workflow.creating")}
                disabled={
                  !(preflight.consentRecorded || consent)
                  || !eligibility.eligible
                  || !checklistReady
                  || !preflight.passportUploaded
                  || !preflight.photoUploaded
                  || preflight.missingApplicationFields.length > 0
                }
                onClick={() => void startAutomation()}
              >
                <CalendarCheck />{t("workflow.create")}
              </BrandActionButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "account" && job ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-600" />{t("account.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <Alert className="border-brand-100 bg-brand-50"><ShieldCheck className="h-4 w-4 text-brand-600" /><AlertTitle>{t("workflow.publicOnlyTitle")}</AlertTitle><AlertDescription>{t("workflow.publicOnlyBody")}</AlertDescription></Alert>
            {snapshot?.pendingManualAction ? (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertTitle>{t(`checkpoints.${snapshot.pendingManualAction.actionType}`)}</AlertTitle>
                <AlertDescription>{t(`checkpointBodies.${snapshot.pendingManualAction.actionType}`)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("evidence.httpStatus")} value={String(snapshot?.evidence?.httpStatus ?? "-")} />
              <Detail label={t("evidence.pageTitle")} value={String(snapshot?.evidence?.pageTitle ?? "-")} />
              <Detail label={t("evidence.observedAt")} value={String(snapshot?.evidence?.observedAt ?? "-")} />
              <Detail label={t("evidence.entryClick")} value={snapshot?.evidence?.publicEntryClicked ? t("yes") : t("no")} />
              <Detail label={t("evidence.replay")} value={snapshot?.evidence?.browserbaseReplayAvailable ? t("yes") : t("no")} />
            </div>
            <BrandActionButton className="w-full" variant="secondary" loading={busy === "check"} loadingText={t("workflow.checking")} disabled={busy !== null} onClick={() => void action("check", () => checkJapanAppointmentPortal(job.id))}><RefreshCw />{t("workflow.check")}</BrandActionButton>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" asChild><a href={JAPAN_VFS_SG_OFFICIAL_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("workflow.openOfficial")}</a></Button>
              <Button variant="outline" disabled={busy !== null} onClick={() => void action("cancel", () => cancelJapanAppointmentJob(job.id))}>{busy === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{t("workflow.cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "slots" && job ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-brand-600" />{t("slots.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {snapshot?.slots.length ? snapshot.slots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="font-medium">{slot.appointmentDate} {slot.appointmentTime}</div><div className="text-sm text-muted-foreground">{slot.appointmentLocation}</div></div>
                <Button disabled={busy !== null || slot.status === "expired"} onClick={() => void action("select", () => selectJapanAppointmentSlot(job.id, slot.id))}>{t("slots.choose")}</Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">{t("slots.empty")}</p>}
            <Button variant="outline" disabled={busy !== null} onClick={() => void action("check", () => checkJapanAppointmentPortal(job.id))}><RefreshCw className="mr-2 h-4 w-4" />{t("workflow.check")}</Button>
          </CardContent>
        </Card>
      ) : null}

      {stage === "confirm" && job ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-600" />{t("final.title")}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {selectedSlot ? <div className="rounded-[8px] border bg-muted/30 p-4"><div className="font-medium">{selectedSlot.appointmentDate} {selectedSlot.appointmentTime}</div><div className="mt-1 text-sm text-muted-foreground">{selectedSlot.appointmentLocation}</div></div> : null}
            {job.status === "appointment_payment_required" ? <Alert><ExternalLink className="h-4 w-4" /><AlertTitle>{t("payment.officialTitle")}</AlertTitle><AlertDescription>{t("payment.officialBody")}</AlertDescription></Alert> : null}
            <label className="flex items-start gap-3 rounded-[8px] border p-3 text-sm"><Checkbox checked={finalApproved} onCheckedChange={(value) => setFinalApproved(value === true)} /><span>{t("final.consent")}</span></label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!finalApproved || busy !== null || job.status !== "appointment_payment_ready"} onClick={() => void action("approve", () => approveJapanAppointmentFinal(job.id))}>{t("final.approve")}</Button>
              <Button disabled={busy !== null || job.status !== "appointment_final_confirmation_approved"} onClick={() => void action("book", () => bookJapanAppointmentSlot(job.id))}>{busy === "book" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("final.book")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "result" && snapshot?.confirmation ? (
        <Card className="rounded-[8px] border-emerald-200">
          <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" />{t("final.confirmed")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[8px] bg-emerald-50 p-4 text-emerald-950">
              <div className="font-medium">{snapshot.confirmation.appointmentDate} {snapshot.confirmation.appointmentTime}</div>
              <div className="mt-1 text-sm">{snapshot.confirmation.appointmentLocation}</div>
              <div className="mt-2 text-xs">{t("final.confirmation", { number: snapshot.confirmation.confirmationNumber ?? "-", date: snapshot.confirmation.appointmentDate, time: snapshot.confirmation.appointmentTime })}</div>
            </div>
            {snapshot.confirmation.confirmationPdfUrl ? <Button asChild><a href={snapshot.confirmation.confirmationPdfUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("result.openEvidence")}</a></Button> : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function ReviewValue({ label, value, fallback, icon }: { label: string; value: string; fallback: string; icon?: React.ReactNode }) {
  return <div className="rounded-[8px] border p-3"><div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{icon}{label}</div><div className={`mt-1 break-words text-sm ${value ? "text-foreground" : "text-amber-700"}`}>{value || fallback}</div></div>;
}

function DocumentState({ label, ready, yes, no }: { label: string; ready: boolean; yes: string; no: string }) {
  return <div className="flex items-center justify-between rounded-[8px] border p-3 text-sm"><span>{label}</span><Badge variant={ready ? "default" : "secondary"}>{ready ? yes : no}</Badge></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[8px] border bg-muted/30 p-3"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm text-foreground">{value}</div></div>;
}
