"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";

interface Center {
  code: string;
  nameEn: string;
  nameZh: string;
  officialUrl: string;
  bookingUrl: string | null;
  bookingSearchUrl: string | null;
  addressZh: string;
  provinces: string[];
  consularPostZh: string;
  consularPostEn: string;
  serviceMode: string;
  liveBookingMode: string;
  acceptsWalkIn: boolean | null;
  appointmentRuleZh: string;
  appointmentRuleEn: string;
  importantNoticesZh: string[];
  importantNoticesEn: string[];
}

interface Snapshot {
  routing: {
    basis: string;
    recommended: Center;
    alternatives: Center[];
    allCenters?: Center[];
  };
  job: { id: string; status: string; mode?: string | null } | null;
  manualAction: {
    action_type: string;
    instruction: string | null;
    expires_at: string | null;
    metadata_redacted_json?: Record<string, unknown> | null;
  } | null;
  changeIntent: "reschedule" | null;
  rebookingAfterCancellation?: boolean;
  cancellationRefreshRequired?: boolean;
  slots: Array<{
    id: string;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    status: string;
  }>;
  confirmation: {
    confirmation_number: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    confirmation_pdf_url?: string | null;
    confirmation_screenshot_url?: string | null;
    raw_confirmation_redacted_json?: { mode?: string } | null;
  } | null;
  appointmentHistory: Array<{
    id: string;
    confirmation_number: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_location: string | null;
    raw_confirmation_redacted_json?: { mode?: string } | null;
  }>;
}

type Stage =
  | "loading"
  | "center"
  | "otp"
  | "slots"
  | "confirm"
  | "confirmed"
  | "change-query"
  | "cancel-confirmation"
  | "reschedule-restart"
  | "cancelled"
  | "manual";

async function requestSnapshot(applicationId: string, action?: string, slotId?: string, smsCode?: string, selectedCenterCode?: string): Promise<Snapshot> {
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, {
    method: action ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: action ? JSON.stringify({ action, slotId, smsCode, routingInput: selectedCenterCode ? { selectedCenterCode } : undefined }) : undefined,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as Snapshot | { error?: string } | null;
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Request failed: ${response.status}`);
  return body as Snapshot;
}

function isOfficialConfirmation(snapshot: Snapshot | null) {
  const confirmation = snapshot?.confirmation;
  return Boolean(confirmation) && confirmation?.raw_confirmation_redacted_json?.mode !== "dry_run" && !String(confirmation?.confirmation_number ?? "").startsWith("KR-DRYRUN-");
}

function getStage(snapshot: Snapshot | null): Stage {
  if (!snapshot) return "loading";
  const action = snapshot.manualAction?.action_type;
  const cancelled = snapshot.job?.status === "appointment_cancelled";
  const rescheduling = snapshot.changeIntent === "reschedule";
  const selectedSlot = snapshot.slots.some((slot) => ["user_selected", "selected"].includes(slot.status));
  const observedSlots = snapshot.slots.some((slot) => ["observed", "user_selected", "selected"].includes(slot.status));

  if (["official_center_manual_checkpoint", "official_guidance_required", "official_account_login_required"].includes(action ?? "")) return "manual";
  if (rescheduling && cancelled) return "reschedule-restart";
  if (["official_cancel_confirmation_required", "official_cancel_manual_checkpoint"].includes(action ?? "")) return "cancel-confirmation";
  if (["official_reschedule_required", "official_cancel_required"].includes(action ?? "")) return "change-query";
  if (cancelled) return "cancelled";
  if (isOfficialConfirmation(snapshot)) return "confirmed";
  if (action === "sms_verification_required") return "otp";
  if (action === "final_booking_approval_required" || snapshot.job?.status === "final_booking_approved" || selectedSlot) return "confirm";
  if (observedSlots) return "slots";
  return "center";
}

export function KoreaAppointmentAssistant({ applicationId }: { applicationId: string }) {
  const isZh = isChineseLocale(useLocale());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedCenterCode, setSelectedCenterCode] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const rescheduleSmsStartRef = useRef(false);

  const center = snapshot?.routing.recommended;
  const activeCenterCode = selectedCenterCode ?? center?.code;
  const stage = getStage(snapshot);
  const selectedSlot = useMemo(
    () => snapshot?.slots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null,
    [snapshot?.slots],
  );
  const waitingForFinalApproval = snapshot?.manualAction?.action_type === "final_booking_approval_required";
  const finalApproved = snapshot?.job?.status === "final_booking_approved";
  const cancellationAction = snapshot?.manualAction;
  const cancellationIntent = cancellationAction?.metadata_redacted_json?.intent === "reschedule" ? "reschedule" : "cancel";
  const cancellationReady = cancellationAction?.action_type === "official_cancel_confirmation_required";
  const isSmsCenter = center?.liveBookingMode === "sms_sync_supported";
  const changeOperation = busy === "request-reschedule" ? "reschedule" : busy === "request-cancel" ? "cancel" : null;
  const cancellingOfficialBooking = busy === "confirm-cancel-official";
  const startingRescheduleSms = busy === "request-live-booking" && stage === "reschedule-restart";
  const savedAppointment = isOfficialConfirmation(snapshot) ? snapshot?.confirmation ?? null : null;

  const run = useCallback(async (action?: string, slotId?: string, code?: string, centerCode?: string) => {
    setBusy(action ?? "load");
    setError(null);
    try {
      setSnapshot(await requestSnapshot(applicationId, action, slotId, code, centerCode ?? activeCenterCode));
      if (action === "submit-sms-code") setSmsCode("");
      if (action === "start-new-booking") setSmsCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      try {
        setSnapshot(await requestSnapshot(applicationId, undefined, undefined, undefined, centerCode ?? activeCenterCode));
      } catch {
        // Preserve the actionable error from the requested operation.
      }
    } finally {
      setBusy(null);
    }
  }, [activeCenterCode, applicationId]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (!selectedCenterCode && center?.code) setSelectedCenterCode(center.code);
  }, [center?.code, selectedCenterCode]);

  useEffect(() => {
    if (stage !== "reschedule-restart") {
      rescheduleSmsStartRef.current = false;
      return;
    }
    if (busy || rescheduleSmsStartRef.current) return;
    rescheduleSmsStartRef.current = true;
    void run("request-live-booking");
  }, [busy, run, stage]);

  const chooseCenter = useCallback(async (nextCenterCode: string) => {
    setSelectedCenterCode(nextCenterCode);
    await run("refresh-status", undefined, undefined, nextCenterCode);
  }, [run]);

  const stepLabels = isZh ? ["选择领区", "短信验证", "选择时间", "预约结果"] : ["Center", "SMS", "Slot", "Result"];
  const currentStep = stage === "center" || stage === "manual" || stage === "loading" ? 0 : stage === "otp" || stage === "reschedule-restart" ? 1 : stage === "slots" || stage === "confirm" ? 2 : 3;
  const centerName = center ? (isZh ? center.nameZh : center.nameEn) : "";
  const serviceLabel = center?.serviceMode === "appointment_required"
    ? (isZh ? "必须提前预约" : "Appointment required")
    : center?.serviceMode === "center_guidance_required"
      ? (isZh ? "按官方公告递交" : "Follow official guidance")
      : (isZh ? "建议预约优先" : "Appointment preferred");

  return (
    <main className="mx-auto w-full max-w-[860px] space-y-6 py-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="outline" size="icon" aria-label={isZh ? "返回申请表" : "Back to form"} title={isZh ? "返回申请表" : "Back to form"}>
          <Link href={`/client/application/long-form?country=south_korea&visaType=KR_C39_SHORT_TERM_VISIT&applicationId=${encodeURIComponent(applicationId)}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-3xl font-medium text-foreground">{isZh ? "韩国签证预约" : "Korea visa appointment"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isZh ? "在 VIZA 内完成领区选择、官方短信验证、时段选择与预约确认。" : "Complete center selection, official SMS verification, slot selection, and booking confirmation in VIZA."}</p>
        </div>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label={isZh ? "预约步骤" : "Appointment steps"}>
        {stepLabels.map((label, index) => (
          <li key={label} className={`border-t-2 pt-2 text-center text-xs sm:text-sm ${index <= currentStep ? "border-brand-600 text-brand-800" : "border-border text-muted-foreground"}`}>
            <span className="mr-1 font-medium">{index + 1}.</span>{label}
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{isZh ? "当前操作未完成" : "The operation did not complete"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {changeOperation || cancellingOfficialBooking || startingRescheduleSms ? (
        <Card className="rounded-[8px] border-brand-200 bg-brand-50/40" role="status" aria-live="polite">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              <div>
                <div className="font-medium text-foreground">{startingRescheduleSms ? (isZh ? "正在发送新的官方验证码" : "Sending a new official verification code") : cancellingOfficialBooking ? (isZh ? "正在取消官方预约" : "Cancelling the official appointment") : (isZh ? "正在连接官方预约中心" : "Connecting to the official appointment center")}</div>
                <p className="mt-1 text-sm text-muted-foreground">{startingRescheduleSms ? (isZh ? "旧预约已确认取消，正在重新进入官方预约页面发送验证码。完成后会自动显示验证码输入页。" : "The old appointment was cancelled. Re-entering the official booking page to send a verification code; the code page will open automatically.") : cancellingOfficialBooking ? (isZh ? "已收到你的最终确认，正在官网提交取消并保存官方证据。请勿关闭此页面或重复点击。" : "Your final confirmation was received. Submitting the official cancellation and saving evidence. Keep this page open and do not click again.") : (isZh ? (changeOperation === "reschedule" ? "正在查询原预约。找到记录后，仍会请你确认取消，再开始改约。" : "正在查询原预约。找到记录后，仍会请你确认取消。") : (changeOperation === "reschedule" ? "Checking the current booking. You will still confirm its cancellation before rescheduling." : "Checking the current booking. You will still confirm cancellation before anything is cancelled."))}</p>
              </div>
            </div>
            <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li className="flex items-center gap-2">{cancellingOfficialBooking || startingRescheduleSms ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}{isZh ? "查询官方预约" : "Query official booking"}</li>
              <li className="flex items-center gap-2">{startingRescheduleSms ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : cancellingOfficialBooking ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <span className="h-2 w-2 rounded-full bg-border" />}{isZh ? "提交官方取消" : "Submit official cancellation"}</li>
              {cancellationIntent === "reschedule" ? <li className="flex items-center gap-2">{startingRescheduleSms ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <span className="h-2 w-2 rounded-full bg-border" />}{isZh ? "发送新验证码并选择时间" : "Send a new code and choose a slot"}</li> : <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-border" />{isZh ? "保存官方取消证据" : "Save official cancellation evidence"}</li>}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {stage === "loading" ? (
        <Card className="rounded-[8px]"><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-brand-600" />{isZh ? "正在读取预约状态..." : "Loading appointment status..."}</CardContent></Card>
      ) : null}

      {stage === "center" ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-brand-600" />{isZh ? "选择递签领区" : "Choose filing center"}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {snapshot?.rebookingAfterCancellation ? (
              <Alert className="border-emerald-200 bg-emerald-50/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <AlertTitle>{isZh ? "旧预约已取消，请确认新预约领区" : "Old booking cancelled; confirm the new filing center"}</AlertTitle>
                <AlertDescription>{isZh ? "已为本申请创建新的预约流程。上次领区已预选，你可以在发送验证码前修改。" : "A fresh booking flow is ready. The previous center is preselected and can be changed before SMS verification."}</AlertDescription>
              </Alert>
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">{isZh ? "请确认申请资料对应的领区。系统会根据当前居住地或户籍推荐中心；领区不确定时可手动选择。" : "Confirm the jurisdiction that matches your residence or hukou. You can select another center when the recommendation is not applicable."}</p>
            <label className="block text-sm font-medium text-foreground">
              {isZh ? "递签中心" : "Filing center"}
              <select value={activeCenterCode ?? ""} onChange={(event) => void chooseCenter(event.target.value)} disabled={Boolean(busy)} className="mt-2 h-11 w-full rounded-[8px] border bg-white px-3 text-sm outline-none focus:border-brand-500 disabled:bg-muted">
                {(snapshot?.routing.allCenters ?? (center ? [center, ...(snapshot?.routing.alternatives ?? [])] : [])).map((item) => <option key={item.code} value={item.code}>{isZh ? item.nameZh : item.nameEn} ({item.provinces.join(isZh ? "、" : ", ")})</option>)}
              </select>
            </label>
            {center ? <div className="rounded-[8px] border bg-muted/30 p-4 text-sm"><div className="font-medium">{centerName}</div><div className="mt-1 text-muted-foreground">{center.addressZh}</div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full border bg-white px-3 py-1">{serviceLabel}</span><span className="rounded-full border bg-white px-3 py-1">{center.acceptsWalkIn === true ? (isZh ? "可现场取号" : "Walk-in allowed") : center.acceptsWalkIn === false ? (isZh ? "仅预约递交" : "Appointment only") : (isZh ? "现场规则以公告为准" : "Check current walk-in notice")}</span></div></div> : null}
            {snapshot?.routing.basis === "ambiguous" ? <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>{isZh ? "请确认领区是否与可证明的现居住地或户籍地一致。" : "Confirm that the selected center matches your provable residence or hukou."}</AlertDescription></Alert> : null}
            {snapshot?.appointmentHistory.length ? <div className="rounded-[8px] border bg-muted/30 p-4 text-sm"><div className="font-medium">{isZh ? "历史预约记录" : "Appointment history"}</div>{snapshot.appointmentHistory.map((record) => <div key={record.id} className="mt-2 border-t pt-2 text-muted-foreground"><span className="font-medium text-foreground">{record.appointment_date} {record.appointment_time}</span><span className="mx-2">{record.appointment_location}</span><span className="text-xs">{isZh ? "确认号：" : "Confirmation: "}{record.confirmation_number ?? (isZh ? "待官方确认" : "Pending official confirmation")}</span></div>)}</div> : null}
            {savedAppointment ? <div className="rounded-[8px] border border-amber-200 bg-amber-50/50 p-4"><div className="font-medium text-foreground">{isZh ? "此申请已有预约" : "This application already has an appointment"}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{isZh ? "如需改变现有预约，请选择改约或取消。系统会先在官网查询该确认记录，最终取消前仍会请你确认。" : "To change the existing appointment, choose reschedule or cancel. VIZA will first query the official record and will ask you before any final cancellation."}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run("request-reschedule")} disabled={Boolean(busy) || !center}>{busy === "request-reschedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{isZh ? "改约" : "Reschedule"}</Button><Button variant="outline" onClick={() => void run("request-cancel")} disabled={Boolean(busy) || !center}>{busy === "request-cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{isZh ? "取消预约" : "Cancel appointment"}</Button></div>{busy === "request-reschedule" || busy === "request-cancel" ? <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">{isZh ? "正在准备官网预约查询，请勿重复点击。" : "Preparing the official appointment query. Do not click again."}</p> : null}</div> : <><Button onClick={() => void run("request-live-booking")} disabled={Boolean(busy) || !center} className="w-full sm:w-auto">{busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}{isSmsCenter ? (isZh ? "继续发送官方验证码" : "Continue to official SMS") : (isZh ? "查看该中心办理方式" : "View center filing method")}</Button>{busy === "request-live-booking" ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{isZh ? "正在连接官方预约页面并发送验证码，请勿重复点击。" : "Connecting to the official booking page and sending the code. Do not click again."}</p> : null}</>}
          </CardContent>
        </Card>
      ) : null}

      {stage === "otp" ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-brand-600" />{isZh ? "输入官方短信验证码" : "Enter official SMS code"}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">{isZh ? `验证码已由 ${centerName} 的官方预约页面发送。输入后，VIZA 会将其传入同一官方会话并读取可选时段。验证码不会写入日志或数据库。` : `The official ${centerName} booking page sent the code. VIZA passes it into the same official session to read slots. The code is not stored.`}</p>
            {snapshot?.manualAction?.expires_at ? <p className="text-xs text-muted-foreground">{isZh ? `有效至 ${new Date(snapshot.manualAction.expires_at).toLocaleTimeString()}` : `Expires at ${new Date(snapshot.manualAction.expires_at).toLocaleTimeString()}`}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row"><input value={smsCode} onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder={isZh ? "输入验证码" : "SMS code"} className="h-11 flex-1 rounded-[8px] border bg-white px-3 text-sm outline-none focus:border-brand-500" /><Button onClick={() => void run("submit-sms-code", undefined, smsCode)} disabled={Boolean(busy) || !/^\d{4,8}$/.test(smsCode)}>{busy === "submit-sms-code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}{isZh ? "验证并读取时间" : "Verify and read slots"}</Button></div>
            <Button variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}>{busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{isZh ? "重新发送验证码" : "Resend code"}</Button>
          </CardContent>
        </Card>
      ) : null}

      {stage === "slots" ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-brand-600" />{isZh ? "选择预约时间" : "Choose appointment slot"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{isZh ? "以下时段来自当前官方会话。选择一个时段后，仍会在最终确认前请你授权。" : "These slots came from the current official session. After selection, you will still approve the final booking."}</p>
            {snapshot?.slots.filter((slot) => ["observed", "user_selected", "selected"].includes(slot.status)).map((slot) => <div key={slot.id} className="flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{slot.appointment_date} {slot.appointment_time}</div><div className="text-sm text-muted-foreground">{slot.appointment_location}</div></div><Button variant="outline" onClick={() => void run("select-slot", slot.id)} disabled={Boolean(busy)}>{busy === "select-slot" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{isZh ? "选择此时间" : "Choose this slot"}</Button></div>)}
            <Button variant="ghost" onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />{isZh ? "重新读取时段" : "Refresh slots"}</Button>
          </CardContent>
        </Card>
      ) : null}

      {stage === "confirm" ? (
        <Card className="rounded-[8px]">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-600" />{isZh ? "确认预约" : "Confirm booking"}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[8px] border bg-muted/30 p-4"><div className="font-medium">{selectedSlot?.appointment_date} {selectedSlot?.appointment_time}</div><div className="mt-1 text-sm text-muted-foreground">{selectedSlot?.appointment_location}</div></div>
            <p className="text-sm leading-6 text-muted-foreground">{isZh ? "只有你授权后，后端才会在官方页面点击最终确认；VIZA 仅在官方返回确认号时显示预约成功。" : "The worker clicks the official final confirmation only after your approval. VIZA marks it booked only when the official portal returns a confirmation number."}</p>
            {waitingForFinalApproval ? <Button onClick={() => void run("approve-final-booking")} disabled={Boolean(busy)}>{busy === "approve-final-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{isZh ? "授权最终预约" : "Approve final booking"}</Button> : null}
            {finalApproved ? <Button onClick={() => void run("complete-final-booking")} disabled={Boolean(busy)}>{busy === "complete-final-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{isZh ? "完成官方确认" : "Complete official confirmation"}</Button> : null}
          </CardContent>
        </Card>
      ) : null}

      {stage === "confirmed" && snapshot?.confirmation ? (
        <Card className="rounded-[8px] border-emerald-200">
          <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" />{isZh ? "预约已确认" : "Appointment confirmed"}</CardTitle></CardHeader>
          <CardContent className="space-y-5"><div className="rounded-[8px] bg-emerald-50 p-4 text-sm text-emerald-950"><div className="font-medium">{snapshot.confirmation.appointment_date} {snapshot.confirmation.appointment_time}</div><div className="mt-1">{snapshot.confirmation.appointment_location}</div><div className="mt-2 text-xs">{isZh ? "官方确认号：" : "Official confirmation: "}{snapshot.confirmation.confirmation_number}</div></div><div><div className="font-medium">{isZh ? "到场请准备" : "Bring to the appointment"}</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground"><li>{isZh ? "护照原件及资料页复印件。" : "Original passport and bio-page copy."}</li><li>{isZh ? "官方 Korea Visa Portal 带条码 e-Form 打印件，到场签字。" : "Printed Korea Visa Portal barcode e-Form; sign at filing."}</li><li>{isZh ? "白底 3.5cm x 4.5cm 证件照，以及所选领区要求的行程、在职/在读、资金等材料。" : "White-background 3.5cm x 4.5cm photo plus itinerary, employment/student, financial, and center-specific documents."}</li><li>{isZh ? "预约确认单打印件。" : "Printed appointment confirmation."}</li></ul></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={snapshot.confirmation.confirmation_pdf_url ?? `/api/applications/${applicationId}/korea-appointment-proof-pdf`} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />{isZh ? "下载预约证明" : "Download proof"}</a></Button>{snapshot.confirmation.confirmation_screenshot_url ? <Button asChild variant="outline"><a href={snapshot.confirmation.confirmation_screenshot_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{isZh ? "查看官方证据" : "View official evidence"}</a></Button> : null}</div><div className="border-t pt-5"><div className="font-medium">{isZh ? "改约或取消" : "Reschedule or cancel"}</div><p className="mt-1 text-sm text-muted-foreground">{isZh ? "改约会先在官方流程取消旧预约，再重新发送验证码并选择新时间。" : "Rescheduling cancels the old official appointment first, then restarts SMS verification and slot selection."}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run("request-reschedule")} disabled={Boolean(busy)}>{busy === "request-reschedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{isZh ? "改约" : "Reschedule"}</Button><Button variant="outline" onClick={() => void run("request-cancel")} disabled={Boolean(busy)}>{busy === "request-cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}{isZh ? "取消预约" : "Cancel appointment"}</Button></div></div></CardContent>
        </Card>
      ) : null}

      {stage === "change-query" ? (
        <Card className="rounded-[8px]"><CardHeader><CardTitle className="flex items-center gap-2">{busy ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> : <RefreshCw className="h-5 w-5 text-brand-600" />}{busy ? (isZh ? "正在处理旧预约" : "Processing the existing booking") : (isZh ? "准备处理旧预约" : "Ready to process the existing booking")}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{snapshot?.manualAction?.action_type === "official_reschedule_required" ? (isZh ? "VIZA 已找到本申请保存的预约记录。继续后会在官网取消旧预约，再重新发送验证码选择新时间。" : "VIZA found a booking record saved for this application. Continuing cancels the old official appointment, then restarts SMS verification and slot selection.") : (isZh ? "你已在 VIZA 确认取消。继续后，后端会直接在官网查询、确认取消并复核结果。" : "You already confirmed cancellation in VIZA. Continuing queries, confirms, and verifies the cancellation directly on the official site.")}</p><div className="flex flex-wrap gap-2"><Button onClick={() => void run(snapshot?.manualAction?.action_type === "official_reschedule_required" ? "request-reschedule" : "request-cancel")} disabled={Boolean(busy)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{snapshot?.manualAction?.action_type === "official_reschedule_required" ? (isZh ? "取消旧预约并改约" : "Cancel old booking and reschedule") : (isZh ? "直接取消预约" : "Cancel appointment")}</Button><Button variant="outline" onClick={() => void run("restart-without-booking-record")} disabled={Boolean(busy)}>{busy === "restart-without-booking-record" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{isZh ? "这不是有效预约，重新开始" : "No valid booking, restart"}</Button></div><p className="text-xs leading-5 text-muted-foreground">{isZh ? "重新开始只会清除 VIZA 内的遗留状态，不会在官网取消任何预约。" : "Restart clears stale VIZA state only; it does not cancel anything on the official site."}</p></CardContent></Card>
      ) : null}

      {stage === "cancel-confirmation" ? (
        <Card className="rounded-[8px] border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              {cancellationReady ? cancellationIntent === "reschedule" ? (isZh ? "确认取消旧预约后改约" : "Cancel old booking before rescheduling") : (isZh ? "直接取消预约" : "Cancel appointment directly") : (isZh ? "取消操作需要重试" : "Cancellation needs a retry")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedAppointment ? (
              <section className="space-y-4 rounded-[8px] border bg-background p-4" aria-labelledby="current-appointment-details">
                <div>
                  <h2 id="current-appointment-details" className="font-medium text-foreground">{isZh ? "当前递签详情" : "Current filing details"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{isZh ? "请在操作前核对以下已保存的预约信息。" : "Review the saved appointment details before making a change."}</p>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><div className="text-muted-foreground">{isZh ? "递签时间" : "Appointment time"}</div><div className="mt-1 font-medium">{savedAppointment.appointment_date} {savedAppointment.appointment_time}</div></div>
                  <div><div className="text-muted-foreground">{isZh ? "递签地点" : "Filing location"}</div><div className="mt-1 font-medium">{savedAppointment.appointment_location}</div></div>
                  <div className="sm:col-span-2"><div className="text-muted-foreground">{isZh ? "官方确认号" : "Official confirmation"}</div><div className="mt-1 font-medium">{savedAppointment.confirmation_number}</div></div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-medium text-foreground">{isZh ? "到场材料" : "What to bring"}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                    <li>{isZh ? "护照原件及资料页复印件。" : "Original passport and a copy of its bio page."}</li>
                    <li>{isZh ? "官方 Korea Visa Portal 带条码 e-Form 打印件，到场签字。" : "Printed Korea Visa Portal barcode e-Form; sign it at filing."}</li>
                    <li>{isZh ? "预约确认单打印件，以及所选领区要求的行程、在职/在读、资金等材料。" : "Printed appointment confirmation plus itinerary, employment/student, financial, and center-specific documents."}</li>
                    <li>{isZh ? "如电子表格或所选领区要求，携带白底 3.5cm x 4.5cm 证件照。" : "Bring a 3.5cm x 4.5cm white-background photo if required by the e-Form or selected center."}</li>
                  </ul>
                </div>
              </section>
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">
              {cancellationReady ? (isZh ? "你已在 VIZA 确认取消。点击后，VIZA 会直接在官网完成取消并保存官方证据。此操作不能撤销。" : "You already confirmed cancellation in VIZA. Clicking below completes the cancellation on the official site and saves evidence. This cannot be undone.") : (isZh ? "本次官网会话未能完成取消。重新尝试会重新建立官网会话；只有官网明确返回成功或无预约记录时，VIZA 才会显示已取消。" : "The official session did not complete the cancellation. Retrying creates a fresh official session; VIZA marks it cancelled only after an official success or no-record result.")}
            </p>
            {snapshot?.cancellationRefreshRequired ? (
              <Alert>
                <RefreshCw className="h-4 w-4" />
                <AlertTitle>{isZh ? "官方取消会话已刷新" : "Official cancellation session refreshed"}</AlertTitle>
                <AlertDescription>{isZh ? "原会话已过期，VIZA 已重新查询官网预约。请再次确认，系统才会提交取消。" : "The previous session expired. VIZA queried the official booking again. Confirm once more before cancellation is submitted."}</AlertDescription>
              </Alert>
            ) : null}
            {cancellationReady ? (
              <>
                <Button variant="destructive" onClick={() => void run("confirm-cancel-official")} disabled={Boolean(busy)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {cancellingOfficialBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {cancellationIntent === "reschedule" ? (isZh ? "取消旧预约并继续改约" : "Cancel and continue rescheduling") : (isZh ? "直接取消预约" : "Cancel appointment")}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => void run("start-cancel-query")} disabled={Boolean(busy)}>
                {busy === "start-cancel-query" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {isZh ? "重新查询取消入口" : "Retry cancellation query"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {stage === "reschedule-restart" && !startingRescheduleSms ? (
        <Card className="rounded-[8px] border-emerald-200"><CardHeader><CardTitle className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" />{isZh ? "旧预约已取消" : "Old booking cancelled"}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{isZh ? "现在重新发送官方验证码，选择新的预约时间。" : "Now send a fresh official SMS code and choose a new appointment time."}</p><Button onClick={() => void run("request-live-booking")} disabled={Boolean(busy)}>{busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}{isZh ? "发送新验证码" : "Send new code"}</Button></CardContent></Card>
      ) : null}

      {stage === "cancelled" ? (
        <Card className="rounded-[8px] border-emerald-200">
          <CardContent className="space-y-4 p-6">
            <div>
              <div className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5" />{isZh ? "预约已取消" : "Appointment cancelled"}</div>
              <p className="mt-2 text-sm text-muted-foreground">{isZh ? "VIZA 已收到官方取消结果，并保留了旧预约与取消证据。你可以现在创建一条全新的预约流程。" : "VIZA received the official cancellation result and preserved the old booking and cancellation evidence. You can now start a fresh booking flow."}</p>
            </div>
            <Button onClick={() => void run("start-new-booking")} disabled={Boolean(busy)}>
              {busy === "start-new-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {busy === "start-new-booking"
                ? (isZh ? "正在创建新预约..." : "Starting a new booking...")
                : (isZh ? "重新预约" : "Book again")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {stage === "manual" && center ? (
        <Card className="rounded-[8px]"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" />{isZh ? "该领区需要按官方指引办理" : "This center follows official guidance"}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{isZh ? "该中心没有可验证的统一短信预约流程，或官方站点出现账号、实名等必须由申请人处理的门槛。VIZA 不会把它标记为预约成功。" : "This center has no verifiable unified SMS booking flow, or its official site has an applicant-only gate such as account or real-name verification. VIZA will not mark it as booked."}</p><div className="rounded-[8px] border bg-muted/30 p-4 text-sm"><div className="font-medium">{centerName}</div><div className="mt-1 text-muted-foreground">{isZh ? center.appointmentRuleZh : center.appointmentRuleEn}</div>{(isZh ? center.importantNoticesZh : center.importantNoticesEn).map((notice) => <div key={notice} className="mt-2 text-xs text-muted-foreground">{notice}</div>)}</div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/client/applications/${applicationId}/korea-appointment/rules`}>{isZh ? "查看递签规则" : "View filing rules"}</Link></Button><Button asChild variant="outline"><a href={center.bookingUrl ?? center.officialUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{isZh ? "打开官方入口" : "Open official entry"}</a></Button></div></CardContent></Card>
      ) : null}
    </main>
  );
}
