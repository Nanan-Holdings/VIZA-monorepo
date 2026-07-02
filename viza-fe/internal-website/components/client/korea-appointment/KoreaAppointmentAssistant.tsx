"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, Download, ExternalLink, Loader2, MapPin, MessageSquareText, RefreshCw } from "lucide-react";
import { useLocale } from "next-intl";
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
      officialUrl: string;
      provinces: string[];
      serviceMode: string;
      acceptsWalkIn: boolean | null;
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

async function requestSnapshot(applicationId: string, action?: string, slotId?: string, smsCode?: string): Promise<Snapshot> {
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, {
    method: action ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: action ? JSON.stringify({ action, slotId, smsCode }) : undefined,
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
  const selectedSlot = useMemo(
    () => snapshot?.slots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null,
    [snapshot?.slots],
  );
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
  const hasOfficialConfirmation =
    Boolean(snapshot?.confirmation) &&
    snapshot?.confirmation?.raw_confirmation_redacted_json?.mode !== "dry_run" &&
    !String(snapshot?.confirmation?.confirmation_number ?? "").startsWith("KR-DRYRUN-");
  const showLiveStartButton =
    !waitingForSms &&
    !waitingForFinalApproval &&
    !finalApproved &&
    !centerManualAction &&
    !snapshot?.confirmation;

  const run = useCallback(async (action?: string, slotId?: string, nextSmsCode?: string) => {
    setBusy(action ?? "load");
    setError(null);
    try {
      setSnapshot(await requestSnapshot(applicationId, action, slotId, nextSmsCode));
      if (action === "submit-sms-code") setSmsCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [applicationId]);

  useEffect(() => {
    void run();
  }, [run]);

  const center = snapshot?.routing.recommended;
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
  const liveStartLabel = useMemo(() => {
    if (!center) return isZh ? "启动官方预约助手" : "Start official assistant";
    if (center.liveBookingMode === "sms_sync_supported") return isZh ? "进入短信验证" : "Start SMS verification";
    if (center.liveBookingMode === "official_guidance_only") return isZh ? "查看官方递签指引" : "Show official filing guidance";
    return isZh ? "启动官方预约助手" : "Start official assistant";
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
          <Button asChild>
            <a href="https://www.visa.go.kr/openPage.do?MENU_ID=10204" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              {isZh ? "官方 e-Form" : "Official e-Form"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/applications/${applicationId}/kr-annex17-pdf`} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
              {isZh ? "备用 Annex-17" : "Fallback Annex-17"}
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
              <Alert className={center.serviceMode === "appointment_required" ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50/70"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{isZh ? "递签规则提醒" : "Submission rule reminder"}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{isZh ? center.appointmentRuleZh : center.appointmentRuleEn}</p>
                  <p>{isZh ? center.liveBookingRuleZh : center.liveBookingRuleEn}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {(isZh ? center.importantNoticesZh : center.importantNoticesEn).map((notice) => (
                      <li key={notice}>{notice}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {isZh ? "规则来源刷新：" : "Source checked: "}
                      {center.sourceCheckedAt}
                    </span>
                    {center.sourceUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {isZh ? `官方来源 ${index + 1}` : `Official source ${index + 1}`}
                      </a>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
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
              <div className="rounded-[8px] border border-dashed p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{isZh ? "其他大陆递签渠道" : "Other mainland filing channels"}</div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {snapshot.routing.alternatives.slice(0, 7).map((alternative) => (
                    <div key={alternative.code} className="flex items-center justify-between gap-3">
                      <span>{isZh ? alternative.nameZh : alternative.nameEn}</span>
                      <a
                        href={alternative.bookingUrl ?? alternative.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 underline underline-offset-2"
                      >
                        {isZh ? "查看" : "View"}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{isZh ? "正在读取推荐中心。" : "Loading center recommendation."}</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[8px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand-500" />
            {isZh ? "可预约时间" : "Available slots"}
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
            <Button onClick={() => void run("start-slot-search")} disabled={Boolean(busy)}>
              {busy === "start-slot-search" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isZh ? "Dry-run 查询时间" : "Dry-run slots"}
            </Button>
            <Button variant="outline" onClick={() => void run("refresh-status")} disabled={Boolean(busy)}>
              {isZh ? "刷新状态" : "Refresh"}
            </Button>
          </div>
          {(snapshot?.slots ?? []).length === 0 ? (
            <div className="rounded-[8px] border border-dashed p-5 text-sm text-muted-foreground">
              {isZh ? "还没有读取到时段。" : "No slots observed yet."}
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
            {isLiveAssisted ? (isZh ? "等待最终授权" : "Waiting for final approval") : (isZh ? "确认预约" : "Confirm booking")}
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void run("request-live-booking")}
                disabled={Boolean(busy) || !center}
              >
                {busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                {liveStartLabel}
              </Button>
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
          {smsManualAction ? (
            <div className="rounded-[8px] border border-brand-100 bg-brand-50/40 p-4">
              <div className="text-sm font-medium text-foreground">
                {isZh ? "正在等待短信验证码" : "Waiting for SMS code"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {smsManualAction.expires_at
                  ? isZh ? `有效期至 ${new Date(smsManualAction.expires_at).toLocaleTimeString()}` : `Expires at ${new Date(smsManualAction.expires_at).toLocaleTimeString()}`
                  : isZh ? "请尽快输入。" : "Enter it as soon as it arrives."}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="h-10 rounded-[8px] border px-3 text-sm outline-none focus:border-brand-500"
                  placeholder={isZh ? "输入短信验证码" : "SMS code"}
                />
                <Button
                  onClick={() => void run("submit-sms-code", undefined, smsCode)}
                  disabled={Boolean(busy) || !/^\d{4,8}$/.test(smsCode)}
                >
                  {busy === "submit-sms-code" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isZh ? "提交验证码" : "Submit code"}
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
              <AlertTitle>{isZh ? "已授权最终预约" : "Final booking approved"}</AlertTitle>
              <AlertDescription>
                {isZh ? "worker 可以完成官方最后一步；拿到官方确认号后会显示并提供预约证明下载。" : "The worker can complete the official final step; once the portal returns a confirmation number, proof will appear here."}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
