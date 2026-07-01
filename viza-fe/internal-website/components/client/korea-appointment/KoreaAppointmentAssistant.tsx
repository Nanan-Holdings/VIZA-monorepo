"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Download, Loader2, MapPin, MessageSquareText, RefreshCw } from "lucide-react";
import { useLocale } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChineseLocale } from "@/lib/i18n/locale";

interface Snapshot {
  routing: {
    basis: string;
    recommended: {
      code: string;
      nameEn: string;
      nameZh: string;
      bookingUrl: string;
      addressZh: string;
      serviceMode: string;
    };
  };
  job: { id: string; status: string } | null;
  manualAction: {
    id: string;
    action_type: string;
    status: string;
    instruction: string | null;
    expires_at: string | null;
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
  const waitingForSms = snapshot?.manualAction?.action_type === "sms_verification_required";
  const waitingForFinalApproval = snapshot?.manualAction?.action_type === "final_booking_approval_required";
  const finalApproved = snapshot?.job?.status === "final_booking_approved";
  const smsManualAction = waitingForSms ? snapshot?.manualAction : null;
  const finalApprovalAction = waitingForFinalApproval ? snapshot?.manualAction : null;
  const hasOfficialConfirmation =
    Boolean(snapshot?.confirmation) &&
    snapshot?.confirmation?.raw_confirmation_redacted_json?.mode !== "dry_run" &&
    !String(snapshot?.confirmation?.confirmation_number ?? "").startsWith("KR-DRYRUN-");

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

  return (
    <div className="mx-auto w-full max-w-[1090px] space-y-5 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-[34px] font-medium text-foreground">
            {isZh ? "韩国签证预约" : "Korea visa appointment"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isZh
              ? "VIZA 会先读取 KVAC 可用时段；你选择时间后，后端才会继续预约并保存确认凭证。"
              : "VIZA observes KVAC slots first. The backend books only after you choose a slot, then saves confirmation evidence."}
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`/api/applications/${applicationId}/kr-annex17-pdf`} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            {isZh ? "下载申请表" : "Download form"}
          </a>
        </Button>
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
              <div className="font-medium">{isZh ? center.nameZh : center.nameEn}</div>
              <div className="text-sm text-muted-foreground">{center.addressZh}</div>
              <Button asChild variant="ghost" className="px-0">
                <a href={center.bookingUrl} target="_blank" rel="noopener noreferrer">
                  {isZh ? "打开官方预约页面" : "Open official booking page"}
                </a>
              </Button>
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run("start-slot-search")} disabled={Boolean(busy)}>
              {busy === "start-slot-search" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isZh ? "查询可用时间" : "Check slots"}
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
          <Button onClick={() => void run("confirm-booking")} disabled={Boolean(busy) || !selectedSlot || Boolean(snapshot?.confirmation)}>
            {busy === "confirm-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {isZh ? "确认预约" : "Confirm booking"}
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
            {isZh ? "真实预约短信验证" : "Live booking SMS verification"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            {isZh
              ? "KVAC 手机验证码不能绕过。真实预约时，worker 会在官方页面发起短信验证并暂停；你在 5 分钟内输入验证码后，worker 才继续。验证码不会明文写入日志或数据库。"
              : "KVAC SMS verification cannot be bypassed. During live booking, the worker pauses after triggering the official SMS; enter the code within 5 minutes so it can continue. The code is not stored in plaintext logs or database rows."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void run("request-live-booking")}
              disabled={Boolean(busy) || !selectedSlot || Boolean(snapshot?.confirmation) || waitingForSms || waitingForFinalApproval || finalApproved}
            >
              {busy === "request-live-booking" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
              {isZh ? "进入真实预约验证" : "Start live verification"}
            </Button>
          </div>
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
                  ? "验证码已提交。请确认允许 worker 在官方 KVAC 页面点击最后的预约确认按钮；只有官方页面返回确认号后，VIZA 才会保存预约证明。"
                  : "The SMS code has been submitted. Approve the worker to click the final booking button on the official KVAC page; VIZA saves proof only after the official portal returns a confirmation number."}
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
