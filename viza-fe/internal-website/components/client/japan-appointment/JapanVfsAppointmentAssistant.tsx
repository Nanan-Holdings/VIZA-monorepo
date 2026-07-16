"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarCheck, CheckCircle2, ExternalLink, FileCheck2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
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
  cancelJapanAppointmentJob,
  approveJapanAppointmentFinal,
  bookJapanAppointmentSlot,
  checkJapanAppointmentPortal,
  createJapanAppointmentJob,
  getJapanAppointmentStatus,
  JapanAppointmentApiError,
  recordJapanAppointmentConsent,
  recordJapanAppointmentPayment,
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
import type { JapanAppointmentSnapshot } from "@/types/japan-appointment";

interface Props { applicationId: string }
type Busy = "load" | "photo" | "consent" | "create" | "check" | "select" | "payment" | "approve" | "book" | "cancel" | null;
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
  const [snapshot, setSnapshot] = useState<JapanAppointmentSnapshot | null>(null);
  const [busy, setBusy] = useState<Busy>("load");
  const [error, setError] = useState<string | null>(null);
  const [paymentPan, setPaymentPan] = useState("");
  const [paymentExpiry, setPaymentExpiry] = useState("");
  const [paymentCvv, setPaymentCvv] = useState("");
  const [paymentHolder, setPaymentHolder] = useState("");
  const [finalApproved, setFinalApproved] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const autoPhotoAttemptedRef = useRef(false);

  const eligibility = getJapanVfsEligibility({
    nationality: "China", passportType: "ordinary", singaporePassType: passType,
    singaporePassExpiryDate: passExpiry, intendedReturnDate: returnDate,
  });
  const checklist = useMemo(() => getJapanVfsChecklist(visaType, occupation), [visaType, occupation]);
  const checklistReady = checklist.every((item) => confirmed.has(item.id));
  const job = snapshot?.job ?? null;
  const activeJob = job?.status === "appointment_cancelled" ? null : job;
  const preflight = snapshot?.preflight;
  const consentRecorded = preflight?.consentRecorded === true;

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
    try { setSnapshot(await getJapanAppointmentStatus(applicationId)); }
    catch (cause) { setError(localizedError(cause, "load")); }
    finally { setBusy(null); }
  }, [applicationId, localizedError]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!snapshot || snapshot.preflight.photoUploaded || autoPhotoAttemptedRef.current) return;
    autoPhotoAttemptedRef.current = true;
    setBusy("photo");
    reuseUniversalProfileDocument({ applicationId, documentType: "photo", requirementKey: "photo", required: true })
      .then((result) => result.ok ? load() : setError(t("documents.noProfilePhoto")))
      .finally(() => setBusy(null));
  }, [applicationId, load, snapshot, t]);

  const replacePhoto = async (file: File) => {
    setBusy("photo"); setError(null);
    try {
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
      await load();
    } catch {
      setError(t("documents.photoUploadFailed"));
    } finally { setBusy(null); }
  };

  const action = async (kind: Exclude<Busy, "load" | null>, run: () => Promise<unknown>) => {
    setBusy(kind); setError(null);
    try { await run(); await load(); }
    catch (cause) { setError(localizedError(cause, "action")); setBusy(null); }
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

  if (busy === "load" && !snapshot) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><Loader2 className="h-12 w-12 animate-spin text-brand-500" /><p className="text-lg text-muted-foreground">{t("loading")}</p></div>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 py-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-brand-600">{t("eyebrow")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-3xl font-semibold">{t("title")}</h1><p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{t("subtitle")}</p></div>
          <Badge variant={activeJob ? "default" : "secondary"}>{job ? t(`statuses.${job.status}`) : t("statuses.not_started")}</Badge>
        </div>
      </header>

      <Alert className="border-brand-100 bg-brand-50"><ShieldCheck className="h-4 w-4 text-brand-600" /><AlertTitle>{t("free.title")}</AlertTitle><AlertDescription>{t("free.body")}</AlertDescription></Alert>
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{t("errors.title")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <Card><CardHeader><CardTitle>{t("eligibility.title")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <BrandField label={t("eligibility.visaType")} htmlFor="jp-visa-type"><select id="jp-visa-type" className={SELECT_CLASS} value={visaType} onChange={(event) => setVisaType(event.target.value as JapanVisaRequestType)} disabled={Boolean(job)}><option value="single_entry">{t("visaTypes.single_entry")}</option><option value="double_entry">{t("visaTypes.double_entry")}</option><option value="multiple_entry">{t("visaTypes.multiple_entry")}</option></select></BrandField>
        <BrandField label={t("eligibility.occupation")} htmlFor="jp-occupation"><select id="jp-occupation" className={SELECT_CLASS} value={occupation} onChange={(event) => setOccupation(event.target.value as JapanApplicantOccupation)} disabled={Boolean(job)}><option value="employed">{t("occupations.employed")}</option><option value="self_employed">{t("occupations.self_employed")}</option><option value="student">{t("occupations.student")}</option><option value="retired">{t("occupations.retired")}</option><option value="housewife">{t("occupations.housewife")}</option><option value="unemployed">{t("occupations.unemployed")}</option></select></BrandField>
        <BrandField label={t("eligibility.passType")} htmlFor="jp-pass-type"><select id="jp-pass-type" className={SELECT_CLASS} value={passType} onChange={(event) => setPassType(event.target.value as SingaporePassType)} disabled={Boolean(job)}><option value="">{t("select")}</option>{["pr","employment_pass","s_pass","work_permit","dependent_pass","long_term_visit_pass","student_pass"].map((value) => <option key={value} value={value}>{t(`passTypes.${value}`)}</option>)}</select></BrandField>
        <BrandField label={t("eligibility.passExpiry")}><DatePicker value={passExpiry} onChange={setPassExpiry} /></BrandField>
        <BrandField label={t("eligibility.returnDate")}><DatePicker value={returnDate} onChange={setReturnDate} /></BrandField>
        <div className="self-end rounded-lg border border-input p-3"><Badge variant={eligibility.eligible ? "default" : "secondary"}>{eligibility.eligible ? t("eligibility.pass") : t("eligibility.incomplete")}</Badge><p className="mt-2 text-sm text-muted-foreground">{locale === "zh" ? eligibility.reasonZh : t(eligibility.eligible ? "eligibility.passBody" : "eligibility.incompleteBody")}</p></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-brand-500" />{t("documents.title")}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm leading-6 text-muted-foreground">{t("documents.body")}</p>
        {preflight && <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t("documents.passportStored")}</span><Badge variant={preflight.passportUploaded ? "default" : "secondary"}>{preflight.passportUploaded ? t("yes") : t("no")}</Badge></div>
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{t("documents.photoStored")}</span><Badge variant={preflight.photoUploaded ? "default" : "secondary"}>{preflight.photoUploaded ? t("yes") : t("no")}</Badge></div>
        </div>}
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
          <div className="font-medium">{t("documents.profilePhotoTitle")}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{preflight?.photoUploaded ? t("documents.profilePhotoSelected") : busy === "photo" ? t("documents.profilePhotoLoading") : t("documents.profilePhotoMissing")}</p>
          <input ref={photoInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replacePhoto(file); }} />
          <Button type="button" variant="outline" className="mt-3" disabled={busy === "photo"} onClick={() => photoInputRef.current?.click()}>{busy === "photo" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("documents.replaceProfilePhoto")}</Button>
        </div>
        {preflight && preflight.missingApplicationFields.length > 0 && <Alert className="border-amber-200 bg-amber-50"><AlertCircle className="h-4 w-4 text-amber-700" /><AlertTitle>{t("documents.profileIncomplete")}</AlertTitle><AlertDescription>{t("documents.profileMissing", { fields: preflight.missingApplicationFields.join(", ") })}</AlertDescription></Alert>}
        {checklist.map((item) => <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={confirmed.has(item.id)} onCheckedChange={() => setConfirmed((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span className="font-medium">{locale === "zh" ? item.labelZh : item.labelEn}</span></label>)}
        <Button variant="outline" className="w-full" asChild><a href={`/client/documents?applicationId=${encodeURIComponent(applicationId)}`}><FileCheck2 className="mr-2 h-4 w-4" />{t("documents.manage")}</a></Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{t("workflow.title")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><span>{t("workflow.consent")}</span></label>
        {consentRecorded && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-700" /><AlertTitle>{t("workflow.consentRecorded")}</AlertTitle><AlertDescription>{t("workflow.consentRecordedBody")}</AlertDescription></Alert>}
        {job?.status === "appointment_cancelled" && <Alert><RefreshCw className="h-4 w-4" /><AlertTitle>{t("workflow.restartTitle")}</AlertTitle><AlertDescription>{t("workflow.restartBody")}</AlertDescription></Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <BrandActionButton variant="secondary" loading={busy === "consent"} loadingText={t("workflow.saving")} disabled={!consent || consentRecorded || Boolean(activeJob)} onClick={() => action("consent", () => recordJapanAppointmentConsent(applicationId, { ...eligibilityPayload, acceptedAt: new Date().toISOString() }))}><ShieldCheck />{t("workflow.saveConsent")}</BrandActionButton>
          <BrandActionButton loading={busy === "create"} loadingText={t("workflow.creating")} disabled={!eligibility.eligible || !checklistReady || Boolean(activeJob) || !consentRecorded || !preflight?.passportUploaded || !preflight.photoUploaded || preflight.missingApplicationFields.length > 0} onClick={() => action("create", () => createJapanAppointmentJob(applicationId, eligibilityPayload))}><CalendarCheck />{job?.status === "appointment_cancelled" ? t("workflow.restart") : t("workflow.create")}</BrandActionButton>
          <BrandActionButton variant="secondary" loading={busy === "check"} loadingText={t("workflow.checking")} disabled={!activeJob || busy !== null} onClick={() => activeJob && action("check", () => checkJapanAppointmentPortal(activeJob.id))}><RefreshCw />{t("workflow.check")}</BrandActionButton>
        </div>
        {snapshot?.account && <Alert><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertTitle>{t("workflow.aliasReady")}</AlertTitle><AlertDescription>{t("workflow.aliasBody")}</AlertDescription></Alert>}
        {snapshot?.pendingManualAction && <Alert className="border-amber-200 bg-amber-50"><ShieldCheck className="h-4 w-4 text-amber-700" /><AlertTitle>{t(`checkpoints.${snapshot.pendingManualAction.actionType}`)}</AlertTitle><AlertDescription>{t(`checkpointBodies.${snapshot.pendingManualAction.actionType}`)}</AlertDescription></Alert>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild><a href={JAPAN_VFS_SG_OFFICIAL_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("workflow.openOfficial")}</a></Button>
          <Button variant="outline" disabled={!activeJob || busy === "cancel"} onClick={() => activeJob && action("cancel", () => cancelJapanAppointmentJob(activeJob.id))}>{busy === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{t("workflow.cancel")}</Button>
        </div>
      </CardContent></Card>

      {job && <Card><CardHeader><CardTitle>{t("slots.title")}</CardTitle></CardHeader><CardContent className="space-y-3">
        {snapshot?.slots.length ? snapshot.slots.map((slot) => <div key={slot.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{slot.appointmentDate} {slot.appointmentTime}</div><div className="text-sm text-muted-foreground">{slot.appointmentLocation}</div></div><Button variant={slot.status === "user_selected" ? "default" : "outline"} disabled={busy !== null || slot.status === "expired"} onClick={() => action("select", () => selectJapanAppointmentSlot(job.id, slot.id))}>{slot.status === "user_selected" ? t("slots.selected") : t("slots.choose")}</Button></div>) : <p className="text-sm text-muted-foreground">{t("slots.empty")}</p>}
      </CardContent></Card>}

      {job && <Card><CardHeader><CardTitle>{t("payment.title")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>{t("payment.secureTitle")}</AlertTitle><AlertDescription>{t("payment.secureBody")}</AlertDescription></Alert>
        <div className="grid gap-4 sm:grid-cols-2"><BrandField label={t("payment.holder")}><input className={SELECT_CLASS} autoComplete="cc-name" value={paymentHolder} onChange={(event) => setPaymentHolder(event.target.value)} /></BrandField><BrandField label={t("payment.cardNumber")}><input className={SELECT_CLASS} autoComplete="cc-number" inputMode="numeric" value={paymentPan} onChange={(event) => setPaymentPan(event.target.value.replace(/[^\d ]/g, ""))} /></BrandField><BrandField label={t("payment.expiry")}><input className={SELECT_CLASS} autoComplete="cc-exp" placeholder="MM/YY" value={paymentExpiry} onChange={(event) => setPaymentExpiry(event.target.value)} /></BrandField><BrandField label={t("payment.cvv")}><input className={SELECT_CLASS} autoComplete="cc-csc" inputMode="numeric" type="password" maxLength={4} value={paymentCvv} onChange={(event) => setPaymentCvv(event.target.value.replace(/\D/g, ""))} /></BrandField></div>
        <Button disabled={busy !== null || paymentPan.replace(/\D/g, "").length < 12 || !/^\d{1,2}\s*\/\s*(?:\d{2}|\d{4})$/.test(paymentExpiry) || !/^\d{3,4}$/.test(paymentCvv) || paymentHolder.trim().length < 2 || !snapshot?.slots.some((slot) => slot.status === "user_selected")} onClick={() => action("payment", async () => { await recordJapanAppointmentPayment(job.id, { card: { pan: paymentPan, expiry: paymentExpiry, cvv: paymentCvv, holderName: paymentHolder } }); setPaymentPan(""); setPaymentExpiry(""); setPaymentCvv(""); setPaymentHolder(""); })}>{busy === "payment" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("payment.authorize")}</Button>
      </CardContent></Card>}

      {job && <Card><CardHeader><CardTitle>{t("final.title")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={finalApproved} onCheckedChange={(value) => setFinalApproved(value === true)} /><span>{t("final.consent")}</span></label>
        <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!finalApproved || busy !== null || job.status !== "appointment_payment_ready"} onClick={() => action("approve", () => approveJapanAppointmentFinal(job.id))}>{t("final.approve")}</Button><Button disabled={busy !== null || job.status !== "appointment_final_confirmation_approved"} onClick={() => action("book", () => bookJapanAppointmentSlot(job.id))}>{busy === "book" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("final.book")}</Button></div>
        {snapshot?.confirmation && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-700" /><AlertTitle>{t("final.confirmed")}</AlertTitle><AlertDescription>{t("final.confirmation", { number: snapshot.confirmation.confirmationNumber ?? "-", date: snapshot.confirmation.appointmentDate, time: snapshot.confirmation.appointmentTime })}</AlertDescription></Alert>}
      </CardContent></Card>}

      <Card><CardHeader><CardTitle>{t("evidence.title")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Detail label={t("evidence.httpStatus")} value={String(snapshot?.evidence?.httpStatus ?? "-")} /><Detail label={t("evidence.pageTitle")} value={String(snapshot?.evidence?.pageTitle ?? "-")} /><Detail label={t("evidence.observedAt")} value={String(snapshot?.evidence?.observedAt ?? "-")} /><Detail label={t("evidence.replay")} value={snapshot?.evidence?.browserbaseReplayAvailable ? t("yes") : t("no")} /></CardContent></Card>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-input bg-muted/30 p-3"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm text-foreground">{value}</div></div>;
}
