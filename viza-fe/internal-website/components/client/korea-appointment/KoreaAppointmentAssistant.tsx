"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, Download, ExternalLink, Info, Loader2, MapPin, MessageSquareText, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";

interface Snapshot {
  routing: {
    basis: string;
    matchedProvince: string | null;
    recommended: {
      code: string;
      nameEn: string;
      nameZh: string;
      officialUrl: string;
      bookingUrl: string | null;
      bookingSearchUrl: string | null;
      addressZh: string;
      phone?: string;
      provinces: string[];
      consularPostZh: string;
      consularPostEn: string;
      serviceMode: string;
      liveBookingMode: string;
      acceptsWalkIn: boolean | null;
      appointmentRuleZh: string;
      appointmentRuleEn: string;
      liveBookingRuleZh: string;
      liveBookingRuleEn: string;
      importantNoticesZh: string[];
      importantNoticesEn: string[];
      sourceUrls: string[];
      sourceCheckedAt: string;
    };
    alternatives: Array<{
      code: string;
      nameEn: string;
      nameZh: string;
      bookingUrl: string | null;
      bookingSearchUrl?: string | null;
      officialUrl: string;
      provinces: string[];
      serviceMode: string;
      acceptsWalkIn: boolean | null;
    }>;
    allCenters?: Array<{
      code: string;
      nameEn: string;
      nameZh: string;
      provinces: string[];
      liveBookingMode: string;
      serviceMode: string;
      bookingSearchUrl?: string | null;
    }>;
  };
  job: { id: string; status: string; mode?: string | null } | null;
  manualAction: {
    id: string;
    action_type: string;
    status: string;
    instruction: string | null;
    expires_at: string | null;
    metadata_redacted_json?: Record<string, unknown> | null;
  } | null;
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
}

async function requestSnapshot(applicationId: string, action?: string, slotId?: string, smsCode?: string, selectedCenterCode?: string): Promise<Snapshot> {
  const routingInput = selectedCenterCode ? { selectedCenterCode } : undefined;
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, {
    method: action ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: action ? JSON.stringify({ action, slotId, smsCode, routingInput }) : undefined,
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as Snapshot | { error?: string } | null;
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Request failed: ${response.status}`);
  return body as Snapshot;
}

export function KoreaAppointmentAssistant({ applicationId }: { applicationId: string }) {
  const isZh = isChineseLocale(useLocale());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [selectedCenterCode, setSelectedCenterCode] = useState<string | null>(null);
  const selectedSlot = useMemo(
    () => snapshot?.slots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null,
    [snapshot?.slots],
  );
  const center = snapshot?.routing.recommended;
  const effectiveCenterCode = selectedCenterCode ?? center?.code ?? null;
  const smsActionExpired =
    Boolean(snapshot?.manualAction?.expires_at) &&
    new Date(snapshot?.manualAction?.expires_at ?? "").getTime() <= Date.now();
  const waitingForSms =
    snapshot?.manualAction?.action_type === "sms_verification_required" &&
    !smsActionExpired;
  const waitingForFinalApproval = snapshot?.manualAction?.action_type === "final_booking_approval_required";
  const finalApproved = snapshot?.job?.status === "final_booking_approved";
  const isLiveAssisted = snapshot?.job?.mode === "live_assisted";
  const smsManualAction = waitingForSms ? snapshot?.manualAction : null;
  const finalApprovalAction = waitingForFinalApproval ? snapshot?.manualAction : null;
  const centerManualAction =
    snapshot?.manualAction && ["official_center_manual_checkpoint", "official_guidance_required", "official_account_login_required"].includes(snapshot.manualAction.action_type)
      ? snapshot.manualAction
      : null;
  const changeManualAction =
    snapshot?.manualAction && ["official_reschedule_required", "official_cancel_required"].includes(snapshot.manualAction.action_type)
      ? snapshot.manualAction
      : null;
  const hasOfficialConfirmation =
    Boolean(snapshot?.confirmation) &&
    snapshot?.confirmation?.raw_confirmation_redacted_json?.mode !== "dry_run" &&
    !String(snapshot?.confirmation?.confirmation_number ?? "").startsWith("KR-DRYRUN-");
  const showLiveStartButton =
    center?.liveBookingMode !== "sms_sync_supported" &&
    !waitingForSms &&
    !waitingForFinalApproval &&
    !finalApproved &&
    !centerManualAction &&
    !snapshot?.confirmation;
  const showSmsSyncPanel = center?.liveBookingMode === "sms_sync_supported";
  const isReadingSlots = busy === "start-slot-search" || busy === "submit-sms-code" || busy === "request-live-booking";
  const hasObservedSlots = (snapshot?.slots ?? []).some((slot) => ["observed", "user_selected", "selected"].includes(slot.status));
  const canRestartSmsForReschedule = changeManualAction?.action_type === "official_reschedule_required";
  const changeMetadata = changeManualAction?.metadata_redacted_json ?? null;
  const officialChangeSearchUrl =
    (typeof changeMetadata?.bookingSearchUrl === "string" ? changeMetadata.bookingSearchUrl : null) ??
    center?.bookingSearchUrl ??
    center?.bookingUrl ??
    center?.officialUrl ??
    null;
  const changeDescription = changeManualAction
    ? changeManualAction.action_type === "official_cancel_required"
      ? isZh
        ? "官网同构 KVAC 站点提供“预先预约查询”入口，先输入访问者名和手机号查询已有预约；查到记录后才可能出现取消操作。VIZA 会把取消保持在检查点，直到拿到官网取消结果或截图证据。"
        : "The matching KVAC sites provide an official appointment query page. Search by visitor name and mobile number first; cancellation options appear only after a matching booking is found. VIZA keeps cancellation as a checkpoint until official evidence is captured."
      : isZh
        ? "改约会重新走官网短信验证并读取新时段；你仍需要先选择新时间，再授权最后提交。原预约不要在官网中手动取消，除非你确认要走取消后重约。"
        : "Rescheduling restarts official SMS verification and reads new slots. You still choose a new slot and approve the final submit. Do not manually cancel the existing booking unless you intend to cancel-and-rebook."
    : null;

  const run = useCallback(async (action?: string, slotId?: string, nextSmsCode?: string) => {
    setBusy(action ?? "load");
    setError(null);
    try {
      setSnapshot(await requestSnapshot(applicationId, action, slotId, nextSmsCode, effectiveCenterCode ?? undefined));
      if (action === "submit-sms-code") setSmsCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      try {
        setSnapshot(await requestSnapshot(applicationId, undefined, undefined, undefined, effectiveCenterCode ?? undefined));
      } catch {
        // Keep the original action error visible if the follow-up refresh also fails.
      }
    } finally {
      setBusy(null);
    }
  }, [applicationId, effectiveCenterCode]);

  const chooseCenter = useCallback(async (nextCenterCode: string) => {
    setSelectedCenterCode(nextCenterCode);
    setBusy("refresh-status");
    setError(null);
    try {
      setSnapshot(await requestSnapshot(applicationId, "refresh-status", undefined, undefined, nextCenterCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [applicationId]);

  useEffect(() => {
    if (!selectedCenterCode && center?.code) setSelectedCenterCode(center.code);
  }, [center?.code, selectedCenterCode]);

  const downloadFilledForm = useCallback(async () => {
    setBusy("download-form");
    setError(null);
    const pdfUrl = `/api/applications/${applicationId}/kr-annex17-pdf`;
    try {
      const response = await fetch(pdfUrl, { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; missingFields?: string[] } | null;
        const missing = body?.missingFields?.length ? `: ${body.missingFields.join(", ")}` : "";
        throw new Error(`${body?.error ?? `PDF request failed: ${response.status}`}${missing}`);
      }
      window.location.href = pdfUrl;
      setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }, [applicationId]);

  useEffect(() => {
    void run();
  }, [run]);

  const serviceModeLabel = useMemo(() => {
    if (!center) return "";
    if (center.serviceMode === "appointment_required") return isZh ? "必须提前预约" : "Appointment required";
    if (center.serviceMode === "center_guidance_required") return isZh ? "按领馆/中心公告办理" : "Follow consulate/center guidance";
    return isZh ? "建议预约优先" : "Appointment preferred";
  }, [center, isZh]);
  const walkInLabel = useMemo(() => {
    if (!center) return "";
    if (center.acceptsWalkIn === true) return isZh ? "可现场取号/Walk-in：官方规则允许，但可能等待更久" : "Walk-in: allowed by current guidance, but waiting may be longer";
    if (center.acceptsWalkIn === false) return isZh ? "不可无预约现场受理" : "No walk-in acceptance without appointment";
    return isZh ? "现场受理规则需以当天公告确认" : "Walk-in acceptance must be confirmed from current notices";
  }, [center, isZh]);
  const liveBookingModeLabel = useMemo(() => {
    if (!center) return "";
    if (center.liveBookingMode === "sms_sync_supported") return isZh ? "VIZA 可同步短信预约" : "VIZA SMS sync supported";
    if (center.liveBookingMode === "site_recon_only") return isZh ? "入口已覆盖，遇门槛转人工" : "Entry covered; gates become manual";
    return isZh ? "仅展示官方指引" : "Official guidance only";
  }, [center, isZh]);
  const centerManualTitle = useMemo(() => {
    if (!center) return "";
    if (center.liveBookingMode === "official_guidance_only") return isZh ? "官方递签指引已就绪" : "Official filing guidance is ready";
    return isZh ? "官方入口已就绪" : "Official entry is ready";
  }, [center, isZh]);
  const centerManualDescription = useMemo(() => {
    if (!center) return "";
    if (center.liveBookingMode === "official_guidance_only") {
      return isZh
        ? "该领区暂无可确认的统一在线预约入口。请按下方领馆公告或指定代办机构要求递交；VIZA 不会把无法验证的渠道标记为预约成功。"
        : "This jurisdiction has no confirmed unified online booking portal. Follow the consulate notices or designated agency channel below; VIZA will not mark an unverified channel as booked.";
    }
    if (center.code === "shenyang") {
      return isZh
        ? "沈阳入口会进入 VFS/KVAC 流程。账号登录、短信、实名、排队或最终提交都会暂停给用户确认，不会假装已经预约成功。"
        : "Shenyang continues through a VFS/KVAC flow. Account login, SMS, real-name, queue, or final submit gates pause for user confirmation instead of pretending success.";
    }
    if (center.code === "chengdu") {
      return isZh
        ? "成都独立预约表入口已覆盖。预约后需要打印访问预约证；遇到最终申请或验证码门槛时会暂停等待用户确认。"
        : "Chengdu's standalone appointment form entry is covered. After booking, the visit appointment certificate must be printed; final apply or verification gates pause for user confirmation.";
    }
    return isZh
      ? "该中心使用独立官方站点。VIZA 会保留官方入口和规则提醒，遇到账号、短信、实名、排队或最终提交门槛时转为人工检查点。"
      : "This center uses a standalone official site. VIZA keeps the official entry and rule reminders, and converts account, SMS, real-name, queue, or final-submit gates into manual checkpoints.";
  }, [center, isZh]);

  return (
    <div className="mx-auto w-full max-w-[1090px] space-y-5 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-[34px] font-medium text-foreground">
            {isZh ? "韩国签证预约" : "Korea visa appointment"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isZh
              ? "真实预约会先进入 KVAC 短信验证；你输入验证码后，后端继续读取可预约时段。选择时间并最终授权后才会预约并保存确认凭证。"
              : "Live booking starts with KVAC SMS verification. After you enter the code, the backend continues to observe slots. It books only after you choose a slot and approve the final click."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void downloadFilledForm()} disabled={Boolean(busy)}>
            {busy === "download-form" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isZh ? "备用 Annex-17" : "Fallback Annex-17"}
          </Button>
          <Button asChild variant="outline">
            <a href="https://www.visa.go.kr/openPage.do?MENU_ID=10204" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {isZh ? "打开官方 e-Form 门户" : "Open official e-Form portal"}
            </a>
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{isZh ? "预约服务暂时不可用" : "Appointment service unavailable"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-500" />
            {isZh ? "推荐递签中心" : "Recommended KVAC center"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {center ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="font-medium">{isZh ? center.nameZh : center.nameEn}</div>
                  <div className="text-sm text-muted-foreground">
                    {isZh ? center.consularPostZh : center.consularPostEn}
                  </div>
                  <div className="text-sm text-muted-foreground">{center.addressZh}</div>
                  <label className="block max-w-md text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      {isZh ? "选择领区/递签中心" : "Choose jurisdiction / filing center"}
                    </span>
                    <select
                      value={effectiveCenterCode ?? ""}
                      onChange={(event) => void chooseCenter(event.target.value)}
                      disabled={Boolean(busy) || Boolean(waitingForSms) || Boolean(waitingForFinalApproval) || (hasOfficialConfirmation && !canRestartSmsForReschedule)}
                      className="h-10 w-full rounded-[8px] border bg-white px-3 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:text-muted-foreground"
                    >
                      {(snapshot.routing.allCenters ?? [center, ...snapshot.routing.alternatives]).map((item) => (
                        <option key={item.code} value={item.code}>
                          {isZh ? item.nameZh : item.nameEn} ({item.provinces.join(isZh ? "、" : ", ")})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-brand-800">{serviceModeLabel}</span>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-800">{liveBookingModeLabel}</span>
                    <span className="rounded-full border px-3 py-1 text-muted-foreground">{walkInLabel}</span>
                    <span className="rounded-full border px-3 py-1 text-muted-foreground">
                      {isZh ? `领区：${center.provinces.join("、")}` : `Jurisdiction: ${center.provinces.join(", ")}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/client/applications/${applicationId}/korea-appointment/rules`}>
                      <Info className="mr-2 h-4 w-4" />
                      {isZh ? "查看递签规则" : "View rules"}
                    </Link>
                  </Button>
                  {center.bookingUrl ? (
                    <Button asChild variant="outline">
                      <a href={center.bookingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {isZh ? "打开官方预约页" : "Official booking"}
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant={center.bookingUrl ? "ghost" : "outline"}>
                    <a href={center.officialUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isZh ? "官方说明" : "Official guidance"}
                    </a>
                  </Button>
                </div>
              </div>
              {snapshot.routing.basis === "ambiguous" ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{isZh ? "领区信息不完整" : "Jurisdiction information incomplete"}</AlertTitle>
                  <AlertDescription>
                    {isZh
                      ? "当前没有可用的居住地或户籍省份，系统默认展示北京并列出其他中心；请在申请资料中补充可证明的现居住地或户籍地后再预约。"
                      : "No usable residence or hukou province is available, so Beijing is shown by default with alternatives. Add a provable current residence or hukou province before booking."}
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{isZh ? "正在读取推荐中心。" : "Loading center recommendation."}</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-brand-500" />
            {isZh ? "1. 官方短信验证" : "1. Official SMS verification"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            {isZh
              ? "先在官网触发短信验证码。你在 VIZA 输入验证码后，后端会同步提交到官方 KVAC 页面，再读取真实可预约时间。"
              : "Trigger the official SMS first. After you enter the code in VIZA, the backend submits it to the official KVAC page and reads live slots."}
          </p>
          {showSmsSyncPanel ? (
            <div className="rounded-[8px] border border-brand-100 bg-brand-50/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {hasOfficialConfirmation
                      ? isZh ? "官方短信验证已完成" : "Official SMS verification complete"
                      : waitingForSms ? (isZh ? "已发送官方短信验证码" : "Official SMS code sent") : (isZh ? "等待发送验证码" : "Ready to send code")}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">
                    {hasOfficialConfirmation
                      ? isZh
                        ? "当前申请已经拿到官方预约确认号。改约需要重新发码并读取新时段。"
                        : "This application already has an official confirmation number. Rescheduling requires a fresh SMS and slot read."
                      : waitingForSms
                      ? isZh ? "请在有效期内输入手机收到的验证码。" : "Enter the code before it expires."
                      : isZh ? "验证码不会明文写入日志或数据库。" : "The code is not stored in plaintext logs or database rows."}
                  </div>
                  {smsManualAction?.expires_at ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {isZh ? `有效期至 ${new Date(smsManualAction.expires_at).toLocaleTimeString()}` : `Expires at ${new Date(smsManualAction.expires_at).toLocaleTimeString()}`}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  onClick={() => void run("request-live-booking")}
                  disabled={Boolean(busy) || waitingForFinalApproval || (hasOfficialConfirmation && !canRestartSmsForReschedule)}
                  className="shrink-0 bg-white"
                >
                  {busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                  {hasOfficialConfirmation && !canRestartSmsForReschedule
                    ? isZh ? "已有确认号" : "Already confirmed"
                    : waitingForSms ? (isZh ? "重新发送验证码" : "Resend code") : (isZh ? "发送验证码" : "Send code")}
                </Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(180px,260px)_auto]">
                <input
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={!waitingForSms || Boolean(busy)}
                  className="h-10 rounded-[8px] border bg-white px-3 text-sm outline-none focus:border-brand-500 disabled:bg-slate-100 disabled:text-muted-foreground"
                  placeholder={isZh ? "输入短信验证码" : "SMS code"}
                />
                <Button
                  onClick={() => void run("submit-sms-code", undefined, smsCode)}
                  disabled={Boolean(busy) || !waitingForSms || !/^\d{4,8}$/.test(smsCode)}
                >
                  {busy === "submit-sms-code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isZh ? "提交验证码并读取时间" : "Submit code and read slots"}
                </Button>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{isZh ? "该中心不是短信同步流程" : "SMS sync is not available for this center"}</AlertTitle>
              <AlertDescription>{centerManualDescription}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand-500" />
            {isZh ? "2. 选择可预约时间" : "2. Choose a slot"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {center ? (
            <Alert className="border-brand-100 bg-brand-50/40">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{isZh ? "选择时段前请确认" : "Confirm before choosing a slot"}</AlertTitle>
              <AlertDescription>
                {center.serviceMode === "center_guidance_required"
                  ? isZh
                    ? "该领区没有已确认的统一在线预约入口，请先按官方公告确认是否需要代办机构或线下递交。"
                    : "This jurisdiction has no confirmed unified online booking portal. Confirm whether agency or in-person filing is required from official notices first."
                  : isZh
                    ? `${serviceModeLabel}。${walkInLabel}。`
                    : `${serviceModeLabel}. ${walkInLabel}.`}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void run("start-slot-search")}
              disabled={Boolean(busy) || (hasOfficialConfirmation && !canRestartSmsForReschedule) || (center?.liveBookingMode === "sms_sync_supported" && !hasObservedSlots)}
            >
              {busy === "start-slot-search" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isZh ? "重新读取时间" : "Refresh slots"}
            </Button>
            <Button variant="outline" onClick={() => void run("refresh-status")} disabled={Boolean(busy)}>
              {isZh ? "刷新状态" : "Refresh"}
            </Button>
          </div>
          {isReadingSlots ? (
            <div className="rounded-[8px] border border-brand-100 bg-white p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                <div>
                  <div className="text-sm font-medium text-foreground">{isZh ? "正在读取官网可预约时间" : "Reading official appointment slots"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {isZh ? "请保持页面打开；读取完成后会自动显示可选时段。" : "Keep this page open. Available slots will appear here when the portal responds."}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {(snapshot?.slots ?? []).length === 0 ? (
            <div className="rounded-[8px] border border-dashed p-5 text-sm text-muted-foreground">
              {center?.liveBookingMode === "sms_sync_supported"
                ? isZh ? "请先完成上方短信验证，系统会随后读取官网时段。" : "Complete SMS verification above; VIZA will then read official slots."
                : isZh ? "还没有读取到时段。" : "No slots observed yet."}
            </div>
          ) : (
            snapshot?.slots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-3 rounded-[8px] border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{slot.appointment_date} {slot.appointment_time}</div>
                  <div className="text-sm text-muted-foreground">{slot.appointment_location}</div>
                </div>
                <Button
                  variant={selectedSlot?.id === slot.id ? "secondary" : "outline"}
                  disabled={Boolean(busy) || selectedSlot?.id === slot.id}
                  onClick={() => void run("select-slot", slot.id)}
                >
                  {selectedSlot?.id === slot.id ? (isZh ? "已选择" : "Selected") : (isZh ? "选择" : "Choose")}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {isZh ? "确认预约" : "Confirm booking"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {selectedSlot
              ? isZh ? `已选择 ${selectedSlot.appointment_date} ${selectedSlot.appointment_time}` : `Selected ${selectedSlot.appointment_date} ${selectedSlot.appointment_time}`
              : isZh ? "请先选择一个时段。" : "Choose a slot first."}
          </p>
          <Button onClick={() => void run("confirm-booking")} disabled={Boolean(busy) || !selectedSlot || Boolean(snapshot?.confirmation) || isLiveAssisted}>
            {busy === "confirm-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {finalApproved
              ? isZh ? "等待官方确认号" : "Waiting for official confirmation"
              : isLiveAssisted ? (isZh ? "等待最终授权" : "Waiting for final approval") : (isZh ? "确认预约" : "Confirm booking")}
          </Button>
          {snapshot?.confirmation ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{isZh ? "预约已确认" : "Appointment confirmed"}</AlertTitle>
              <AlertDescription>
                {snapshot.confirmation.confirmation_number} · {snapshot.confirmation.appointment_date} {snapshot.confirmation.appointment_time}
                {hasOfficialConfirmation ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100">
                      <a
                        href={snapshot.confirmation.confirmation_pdf_url ?? `/api/applications/${applicationId}/korea-appointment-proof-pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {isZh ? "下载预约证明" : "Download proof"}
                      </a>
                    </Button>
                    {snapshot.confirmation.confirmation_screenshot_url ? (
                      <Button asChild size="sm" variant="ghost" className="text-emerald-900 hover:bg-emerald-100">
                        <a href={snapshot.confirmation.confirmation_screenshot_url} target="_blank" rel="noopener noreferrer">
                          {isZh ? "查看官方截图" : "View official screenshot"}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-brand-500" />
            {isZh ? "官方预约助手" : "Official appointment assistant"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            {isZh
              ? "VIZA 会按推荐领区进入官方预约或递签指引。可短信同步的 KVAC 会先发起官方短信验证；独立站、VFS、领馆指引或任何实名/账号/最终提交门槛都会暂停给用户确认。验证码不会明文写入日志或数据库。"
              : "VIZA follows the recommended jurisdiction into the official booking or filing channel. SMS-sync KVAC centers trigger official SMS first; standalone sites, VFS, consulate guidance, or any real-name/account/final-submit gate pause for user confirmation. Codes are not stored in plaintext logs or database rows."}
          </p>
          {showLiveStartButton ? (
            <Alert className="border-brand-100 bg-brand-50/40">
              <MessageSquareText className="h-4 w-4" />
              <AlertTitle>{isZh ? "从短信验证开始" : "Start with SMS verification"}</AlertTitle>
              <AlertDescription>
                {isZh ? "请使用上方“官方短信验证”区域发送验证码，再读取官网时段。" : "Use the official SMS verification section above before reading official slots."}
              </AlertDescription>
            </Alert>
          ) : null}
          {hasOfficialConfirmation ? (
            <div className="rounded-[8px] border border-emerald-200 bg-white p-4">
              <div className="text-sm font-medium text-foreground">
                {isZh ? "到场材料提醒" : "Documents to bring"}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                <li>{isZh ? "护照原件，以及护照资料页复印件。" : "Original passport and a copy of the passport bio page."}</li>
                <li>{isZh ? "官方 Korea Visa Portal 生成的带条码 e-Form 打印件；到场签字。" : "Printed Korea Visa Portal barcode e-Form; sign it at filing."}</li>
                <li>{isZh ? "白底 3.5cm x 4.5cm 证件照。" : "One 3.5cm x 4.5cm white-background visa photo."}</li>
                <li>{isZh ? "预约确认单打印件，以及 VIZA 页面里的官方确认号。" : "Printed appointment confirmation and the official confirmation number shown in VIZA."}</li>
                <li>{isZh ? "行程、机酒订单、在职/在读/资产等材料按所选领区官网要求准备。" : "Itinerary, flight/hotel bookings, employment or student proof, financial documents, and any center-specific materials required by the selected jurisdiction."}</li>
              </ul>
            </div>
          ) : null}
          {centerManualAction && center ? (
            <div className="rounded-[8px] border border-brand-100 bg-brand-50/40 p-4">
              <div className="text-sm font-medium text-foreground">
                {centerManualTitle}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {centerManualDescription}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {center.bookingUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={center.bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isZh ? "打开官方入口" : "Open official entry"}
                    </a>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant={center.bookingUrl ? "ghost" : "outline"}>
                  <a href={center.officialUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {isZh ? "查看官方说明" : "View official guidance"}
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
          {finalApprovalAction ? (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50/60 p-4">
              <div className="text-sm font-medium text-foreground">
                {isZh ? "最终预约确认" : "Final booking approval"}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {isZh
                  ? "验证码已提交且时段已选择。请确认允许 worker 在官方 KVAC 页面点击最后的预约确认按钮；只有官方页面返回确认号后，VIZA 才会保存预约证明。"
                  : "The SMS code has been submitted and a slot is selected. Approve the worker to click the final booking button on the official KVAC page; VIZA saves proof only after the official portal returns a confirmation number."}
              </div>
              <Button
                className="mt-3"
                onClick={() => void run("approve-final-booking")}
                disabled={Boolean(busy)}
              >
                {busy === "approve-final-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isZh ? "授权最终预约" : "Approve final booking"}
              </Button>
            </div>
          ) : null}
          {finalApproved ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{isZh ? "已授权，尚未拿到官方确认号" : "Approved, official confirmation not captured yet"}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {isZh
                    ? "这还不是预约成功。VIZA 只有在官方 KVAC 页面返回确认号后，才会显示“预约已确认”和预约证明下载。若官方会话已过期，请重新发起短信验证。"
                    : "This is not booked yet. VIZA shows appointment confirmation and proof only after the official KVAC page returns a confirmation number. Restart SMS verification if the official session expired."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void run("complete-final-booking")}
                    disabled={Boolean(busy)}
                    className="bg-emerald-700 text-white hover:bg-emerald-800"
                  >
                    {busy === "complete-final-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {isZh ? "完成官方最终提交" : "Complete official final submit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run("request-live-booking")}
                    disabled={Boolean(busy)}
                    className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
                  >
                    {busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                    {isZh ? "重新发短信验证" : "Restart SMS verification"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          {hasOfficialConfirmation ? (
            <div className="rounded-[8px] border p-4">
              <div className="text-sm font-medium text-foreground">
                {isZh ? "改约或取消" : "Reschedule or cancel"}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {isZh
                  ? "改约会重新进入官方短信验证并读取新时段；取消会创建官方取消检查点。只有官网返回改约/取消结果和证据后，VIZA 才会更新最终状态。"
                  : "Rescheduling restarts official SMS verification and reads new slots. Cancellation creates an official cancellation checkpoint. VIZA updates the final state only after official evidence is captured."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void run("request-reschedule")}
                  disabled={Boolean(busy)}
                >
                  {busy === "request-reschedule" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {isZh ? "申请改约" : "Request reschedule"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void run("request-cancel")}
                  disabled={Boolean(busy)}
                >
                  {busy === "request-cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  {isZh ? "申请取消" : "Request cancellation"}
                </Button>
              </div>
            </div>
          ) : null}
          {changeManualAction ? (
            <Alert className="border-amber-200 bg-amber-50/60">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {changeManualAction.action_type === "official_cancel_required"
                  ? isZh ? "取消流程已创建" : "Cancellation checkpoint created"
                  : isZh ? "改约流程已创建" : "Reschedule checkpoint created"}
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{changeDescription}</p>
                {changeManualAction.instruction ? (
                  <p className="text-xs leading-5 text-muted-foreground">{changeManualAction.instruction}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {changeManualAction.action_type === "official_reschedule_required" ? (
                    <Button
                      size="sm"
                      onClick={() => void run("request-live-booking")}
                      disabled={Boolean(busy) || center?.liveBookingMode !== "sms_sync_supported"}
                    >
                      {busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                      {isZh ? "重新发送官网验证码" : "Send a fresh official code"}
                    </Button>
                  ) : null}
                  {officialChangeSearchUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={officialChangeSearchUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {changeManualAction.action_type === "official_cancel_required"
                          ? isZh ? "打开官网查询/取消页" : "Open official query/cancel"
                          : isZh ? "打开官网预约页" : "Open official booking page"}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
