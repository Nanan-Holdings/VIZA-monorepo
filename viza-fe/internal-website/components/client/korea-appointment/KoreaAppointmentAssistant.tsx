"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Download, Loader2, MapPin, RefreshCw } from "lucide-react";
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
  } | null;
}

async function requestSnapshot(applicationId: string, action?: string, slotId?: string): Promise<Snapshot> {
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, {
    method: action ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: action ? JSON.stringify({ action, slotId }) : undefined,
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
  const selectedSlot = useMemo(
    () => snapshot?.slots.find((slot) => ["user_selected", "selected"].includes(slot.status)) ?? null,
    [snapshot?.slots],
  );

  const run = useCallback(async (action?: string, slotId?: string) => {
    setBusy(action ?? "load");
    setError(null);
    try {
      setSnapshot(await requestSnapshot(applicationId, action, slotId));
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
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
