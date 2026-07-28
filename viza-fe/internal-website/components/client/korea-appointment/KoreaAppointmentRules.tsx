"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ExternalLink, Info, MapPin } from "lucide-react";
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
  addressZh?: string;
  provinces: string[];
  consularPostZh?: string;
  consularPostEn?: string;
  serviceMode: string;
  liveBookingMode?: string;
  acceptsWalkIn: boolean | null;
  appointmentRuleZh?: string;
  appointmentRuleEn?: string;
  liveBookingRuleZh?: string;
  liveBookingRuleEn?: string;
  importantNoticesZh?: string[];
  importantNoticesEn?: string[];
  sourceUrls?: string[];
  sourceCheckedAt?: string;
}

interface RulesSnapshot {
  routing: {
    basis: string;
    matchedProvince: string | null;
    recommended: Center;
    alternatives: Center[];
  };
}

async function fetchRules(applicationId: string): Promise<RulesSnapshot> {
  const response = await fetch(`/api/applications/${applicationId}/korea-appointment`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as RulesSnapshot | { error?: string } | null;
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Request failed: ${response.status}`);
  return body as RulesSnapshot;
}

export function KoreaAppointmentRules({ applicationId }: { applicationId: string }) {
  const isZh = isChineseLocale(useLocale());
  const [snapshot, setSnapshot] = useState<RulesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRules(applicationId)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const center = snapshot?.routing.recommended;
  const notices = useMemo(() => {
    if (!center) return [];
    return isZh ? center.importantNoticesZh ?? [] : center.importantNoticesEn ?? [];
  }, [center, isZh]);

  return (
    <div className="mx-auto w-full max-w-[980px] space-y-5 py-8">
      <Button asChild variant="ghost" className="px-0">
        <Link href={`/client/applications/${applicationId}/korea-appointment`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isZh ? "返回预约助手" : "Back to appointment assistant"}
        </Link>
      </Button>

      <div>
        <h1 className="font-heading text-[32px] font-medium text-foreground">
          {isZh ? "韩国递签规则" : "Korea filing rules"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {isZh
            ? "这里集中展示推荐领区、预约/现场递交规则、来源链接和其他大陆递签渠道。规则会变化，最终以官网当天显示为准。"
            : "This page gathers the recommended jurisdiction, appointment or walk-in rules, source links, and other mainland China filing channels. Rules change; the official site remains controlling."}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{isZh ? "无法读取规则" : "Could not load rules"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {center ? (
        <>
          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-500" />
                {isZh ? "推荐递签中心" : "Recommended center"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="font-medium">{isZh ? center.nameZh : center.nameEn}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {isZh ? center.consularPostZh : center.consularPostEn}
                </div>
                {center.addressZh ? <div className="mt-1 text-sm text-muted-foreground">{center.addressZh}</div> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-3 py-1 text-muted-foreground">
                  {isZh ? `领区：${center.provinces.join("、")}` : `Jurisdiction: ${center.provinces.join(", ")}`}
                </span>
                <span className="rounded-full border px-3 py-1 text-muted-foreground">
                  {center.acceptsWalkIn === true
                    ? isZh ? "官方规则允许 Walk-in，但可能等待更久" : "Walk-in allowed by guidance, but waiting may be longer"
                    : center.acceptsWalkIn === false
                      ? isZh ? "不可无预约现场受理" : "No walk-in without appointment"
                      : isZh ? "现场规则需当天确认" : "Walk-in rules must be confirmed same day"}
                </span>
                {snapshot.routing.matchedProvince ? (
                  <span className="rounded-full border px-3 py-1 text-muted-foreground">
                    {isZh ? `匹配省份：${snapshot.routing.matchedProvince}` : `Matched province: ${snapshot.routing.matchedProvince}`}
                  </span>
                ) : null}
              </div>
              <Alert className="border-brand-100 bg-brand-50/40">
                <Info className="h-4 w-4" />
                <AlertTitle>{isZh ? "规则提醒" : "Rule reminder"}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{isZh ? center.appointmentRuleZh : center.appointmentRuleEn}</p>
                  <p>{isZh ? center.liveBookingRuleZh : center.liveBookingRuleEn}</p>
                  {notices.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {notices.map((notice) => <li key={notice}>{notice}</li>)}
                    </ul>
                  ) : null}
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                {center.bookingUrl ? (
                  <Button asChild variant="outline">
                    <a href={center.bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isZh ? "官方预约页" : "Official booking"}
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <a href={center.officialUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {isZh ? "官方说明" : "Official guidance"}
                  </a>
                </Button>
              </div>
              {center.sourceUrls?.length ? (
                <div className="text-xs text-muted-foreground">
                  {isZh ? "规则来源刷新：" : "Sources refreshed:"} {center.sourceCheckedAt ?? "n/a"} ·{" "}
                  {center.sourceUrls.map((source, index) => (
                    <a key={source} className="underline underline-offset-2" href={source} target="_blank" rel="noopener noreferrer">
                      {isZh ? `官方来源 ${index + 1}` : `Source ${index + 1}`}
                      {index < (center.sourceUrls?.length ?? 0) - 1 ? " · " : ""}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {snapshot.routing.basis === "ambiguous" ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{isZh ? "领区信息不完整" : "Jurisdiction information incomplete"}</AlertTitle>
              <AlertDescription>
                {isZh
                  ? "当前没有可用的居住地或户籍省份。请补充可证明的现居住地或户籍地后再预约。"
                  : "No usable current residence or hukou province is available. Add a provable province before booking."}
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="rounded-[8px]">
            <CardHeader>
              <CardTitle>{isZh ? "其他大陆递签渠道" : "Other mainland China channels"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {snapshot.routing.alternatives.map((item) => (
                <div key={item.code} className="rounded-[8px] border p-4">
                  <div className="font-medium">{isZh ? item.nameZh : item.nameEn}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {isZh ? `领区：${item.provinces.join("、")}` : `Jurisdiction: ${item.provinces.join(", ")}`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.bookingUrl ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.bookingUrl} target="_blank" rel="noopener noreferrer">{isZh ? "预约" : "Book"}</a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <a href={item.officialUrl} target="_blank" rel="noopener noreferrer">{isZh ? "查看" : "View"}</a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : !error ? (
        <Card className="rounded-[8px]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {isZh ? "正在读取规则。" : "Loading rules."}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
