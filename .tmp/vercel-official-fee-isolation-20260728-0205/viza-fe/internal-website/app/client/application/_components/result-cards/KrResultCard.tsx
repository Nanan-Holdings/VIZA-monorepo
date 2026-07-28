"use client";

import { useState } from "react";
import { CalendarCheck, Download, FileCheck2, Loader2, MapPin } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveKvacCenter } from "@/lib/korea-c39/kvac-routing";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { KrSubmissionResult } from "@/lib/submission-result";

interface KrResultCardProps {
  applicationId: string;
  result: KrSubmissionResult;
}

function normalizeOfficialEformStatus(value: string | null | undefined): NonNullable<KrSubmissionResult["officialEformStatus"]> {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "manual_action_required" ||
    value === "ready" ||
    value === "failed"
  ) {
    return value;
  }
  return "not_started";
}

export function KrResultCard({ applicationId, result }: KrResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const fallbackCenter = resolveKvacCenter({}).recommended;
  const center = result.recommendedCenter ?? fallbackCenter;
  const [busy, setBusy] = useState(false);
  const [officialPath, setOfficialPath] = useState<string | null>(result.officialEformPdfStoragePath ?? null);
  const [officialStatus, setOfficialStatus] = useState<NonNullable<KrSubmissionResult["officialEformStatus"]>>(
    result.officialEformPdfStoragePath ? "ready" : normalizeOfficialEformStatus(result.officialEformStatus),
  );
  const [officialApplicationNumber, setOfficialApplicationNumber] = useState<string | null>(
    result.officialEformApplicationNumber ?? null,
  );
  const defaultOfficialMessage = isZh
    ? "官方 e-Form 必须通过 Korea Visa Portal 自动生成带条码 PDF；如果官网自动化失败，VIZA 会直接显示错误，不会生成备用 PDF。"
    : "The official barcode e-Form must be generated through Korea Visa Portal automation. If the official automation fails, VIZA shows the error and does not generate a backup PDF.";
  const generationIncompleteMessage = isZh
    ? "本次还没有生成新的官方 PDF。请再次点击生成；如果连续失败，VIZA 会保留为未完成状态，不会把旧 PDF 当作新结果。"
    : "A new official PDF was not generated yet. Click Generate again; VIZA will keep this incomplete instead of reusing an old PDF.";
  const readyOfficialMessage = isZh
    ? "官方 Korea Visa Portal 已按中文界面生成带条码 e-Form PDF。"
    : "The official Korea Visa Portal barcode e-Form PDF has been generated with the Chinese portal view.";
  const [officialMessage, setOfficialMessage] = useState<string | null>(
    result.officialEformPdfStoragePath ? readyOfficialMessage : defaultOfficialMessage,
  );
  const [officialError, setOfficialError] = useState<string | null>(
    result.officialEformStatus === "failed" ? result.manualAction?.instructions ?? generationIncompleteMessage : null,
  );
  const officialReady = officialStatus === "ready" && Boolean(officialPath);
  const officialWorking = officialStatus === "processing" || officialStatus === "queued";

  const openOfficialEformPath = async (path: string) => {
    const response = await fetch(`/api/applications/${applicationId}/artifact-url?path=${encodeURIComponent(path)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !payload?.url) throw new Error(payload?.error ?? `Request failed: ${response.status}`);
    window.open(payload.url, "_blank", "noopener,noreferrer");
  };

  const requestOfficialEform = async () => {
    if (busy) return;
    setBusy(true);
    setOfficialError(null);
    setOfficialPath(null);
    setOfficialApplicationNumber(null);
    setOfficialStatus("processing");
    setOfficialMessage(
      isZh
        ? "正在启动 Korea Visa Portal 自动填写并生成官方 PDF..."
        : "Starting Korea Visa Portal automation to fill and generate the official PDF...",
    );
    try {
      const response = await fetch(`/api/applications/${applicationId}/korea-official-eform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalReviewApproved: true, regenerateOfficialEform: true, pdfLanguage: "zh-CN" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        officialEformPdfStoragePath?: string | null;
        officialEformApplicationNumber?: string | null;
        manualAction?: {
          instructions?: string;
          evidence?: {
            filledSelectors?: string[];
            missingUploads?: string[];
            screenshotPath?: string | null;
          };
        } | null;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Request failed: ${response.status}`);
      const nextPath = payload?.officialEformPdfStoragePath ?? null;
      setOfficialPath(nextPath);
      setOfficialStatus(nextPath ? "ready" : normalizeOfficialEformStatus(payload?.status ?? "manual_action_required"));
      setOfficialApplicationNumber(payload?.officialEformApplicationNumber ?? null);
      setOfficialMessage(
        nextPath
          ? readyOfficialMessage
          : generationIncompleteMessage,
      );
    } catch (error) {
      setOfficialStatus("failed");
      setOfficialMessage(null);
      setOfficialError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const downloadOfficialEform = async () => {
    if (!officialPath || busy) return;
    setBusy(true);
    setOfficialError(null);
    try {
      await openOfficialEformPath(officialPath);
    } catch (error) {
      setOfficialError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <FileCheck2 className="h-5 w-5 text-brand-500" />
            {isZh ? "韩国 C-3-9 官方 e-Form" : "Korea C-3-9 official e-Form"}
          </CardTitle>
          <Badge variant="secondary">KVAC</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <div>
              <div className="font-medium text-foreground">
                {isZh ? center.nameZh : center.nameEn}
              </div>
              <div className="mt-1 text-muted-foreground">{center.addressZh}</div>
            </div>
          </div>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{isZh ? "优先生成并打印 Korea Visa Portal 带条码官方 e-Form。" : "Generate and print the Korea Visa Portal official barcode e-Form first."}</li>
          <li>{isZh ? "官网生成失败时直接报错；不会提供备用 PDF。" : "If official generation fails, VIZA reports the error and does not provide a backup PDF."}</li>
          <li>{isZh ? "在推荐 KVAC 中心选择预约时间，按确认单携带材料递交。" : "Choose an appointment at the recommended KVAC center and bring the confirmation plus documents."}</li>
        </ol>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm">
          <div className="font-medium text-foreground">
            {officialWorking
              ? isZh ? "正在生成官方 e-Form PDF" : "Generating official e-Form PDF"
              : officialReady
                ? isZh ? "官方 e-Form PDF 已可下载" : "Official e-Form PDF is ready"
                : isZh ? "需要生成官方 e-Form PDF" : "Official e-Form PDF required"}
          </div>
          {officialMessage ? <p className="mt-1 leading-6 text-muted-foreground">{officialMessage}</p> : null}
          {officialError ? <p className="mt-1 text-red-600">{officialError}</p> : null}
          {officialApplicationNumber ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh ? "官方申请号：" : "Official application no.:"} {officialApplicationNumber}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Button type="button" onClick={requestOfficialEform} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
              {isZh ? "生成 PDF" : "Generate PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={downloadOfficialEform} disabled={busy || !officialPath}>
              <Download className="mr-2 h-4 w-4" />
              {isZh ? "下载 PDF" : "Download PDF"}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/client/applications/${applicationId}/korea-appointment`}>
                <CalendarCheck className="mr-2 h-4 w-4" />
                {isZh ? "预约面签" : "Book appointment"}
              </Link>
            </Button>
          </div>
          {officialWorking ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {isZh ? "自动化运行中，请勿关闭页面。" : "Automation is running. Keep this page open."}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
