"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  cancelJapanAppointmentJob,
  checkJapanAppointmentPortal,
  createJapanAppointmentJob,
  getJapanAppointmentStatus,
  JapanAppointmentApiError,
  recordJapanAppointmentConsent,
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
type Busy = "load" | "consent" | "create" | "check" | "cancel" | null;
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

  const eligibility = getJapanVfsEligibility({
    nationality: "China", passportType: "ordinary", singaporePassType: passType,
    singaporePassExpiryDate: passExpiry, intendedReturnDate: returnDate,
  });
  const checklist = useMemo(() => getJapanVfsChecklist(visaType, occupation), [visaType, occupation]);
  const checklistReady = checklist.every((item) => confirmed.has(item.id));
  const job = snapshot?.job ?? null;

  const load = useCallback(async () => {
    try { setSnapshot(await getJapanAppointmentStatus(applicationId)); }
    catch (cause) { setError(cause instanceof JapanAppointmentApiError ? cause.message : t("errors.load")); }
    finally { setBusy(null); }
  }, [applicationId, t]);

  useEffect(() => { void load(); }, [load]);

  const action = async (kind: Exclude<Busy, "load" | null>, run: () => Promise<unknown>) => {
    setBusy(kind); setError(null);
    try { await run(); await load(); }
    catch (cause) { setError(cause instanceof JapanAppointmentApiError ? cause.message : t("errors.action")); setBusy(null); }
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
          <Badge variant={job ? "default" : "secondary"}>{job ? t(`statuses.${job.status}`) : t("statuses.not_started")}</Badge>
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
        {checklist.map((item) => <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={confirmed.has(item.id)} onCheckedChange={() => setConfirmed((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} /><span className="font-medium">{locale === "zh" ? item.labelZh : item.labelEn}</span></label>)}
        <Button variant="outline" className="w-full" asChild><a href={`/client/documents?applicationId=${encodeURIComponent(applicationId)}`}><FileCheck2 className="mr-2 h-4 w-4" />{t("documents.manage")}</a></Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{t("workflow.title")}</CardTitle></CardHeader><CardContent className="space-y-4">
        <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><span>{t("workflow.consent")}</span></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <BrandActionButton variant="secondary" loading={busy === "consent"} loadingText={t("workflow.saving")} disabled={!consent || Boolean(job)} onClick={() => action("consent", () => recordJapanAppointmentConsent(applicationId, { ...eligibilityPayload, acceptedAt: new Date().toISOString() }))}><ShieldCheck />{t("workflow.saveConsent")}</BrandActionButton>
          <BrandActionButton loading={busy === "create"} loadingText={t("workflow.creating")} disabled={!eligibility.eligible || !checklistReady || Boolean(job)} onClick={() => action("create", () => createJapanAppointmentJob(applicationId, eligibilityPayload))}><CalendarCheck />{t("workflow.create")}</BrandActionButton>
          <BrandActionButton variant="secondary" loading={busy === "check"} loadingText={t("workflow.checking")} disabled={!job || busy !== null || job.status === "appointment_cancelled"} onClick={() => job && action("check", () => checkJapanAppointmentPortal(job.id))}><RefreshCw />{t("workflow.check")}</BrandActionButton>
        </div>
        {snapshot?.account && <Alert><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertTitle>{t("workflow.aliasReady")}</AlertTitle><AlertDescription>{t("workflow.aliasBody")}</AlertDescription></Alert>}
        {snapshot?.pendingManualAction && <Alert className="border-amber-200 bg-amber-50"><ShieldCheck className="h-4 w-4 text-amber-700" /><AlertTitle>{t(`checkpoints.${snapshot.pendingManualAction.actionType}`)}</AlertTitle><AlertDescription>{snapshot.pendingManualAction.instruction}</AlertDescription></Alert>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild><a href={JAPAN_VFS_SG_OFFICIAL_URL} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("workflow.openOfficial")}</a></Button>
          <Button variant="outline" disabled={!job || job.status === "appointment_cancelled" || busy === "cancel"} onClick={() => job && action("cancel", () => cancelJapanAppointmentJob(job.id))}>{busy === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{t("workflow.cancel")}</Button>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{t("evidence.title")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Detail label={t("evidence.httpStatus")} value={String(snapshot?.evidence?.httpStatus ?? "-")} /><Detail label={t("evidence.pageTitle")} value={String(snapshot?.evidence?.pageTitle ?? "-")} /><Detail label={t("evidence.observedAt")} value={String(snapshot?.evidence?.observedAt ?? "-")} /><Detail label={t("evidence.replay")} value={snapshot?.evidence?.browserbaseReplayAvailable ? t("yes") : t("no")} /></CardContent></Card>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-input bg-muted/30 p-3"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm text-foreground">{value}</div></div>;
}
