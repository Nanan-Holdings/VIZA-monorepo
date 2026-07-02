"use client";

import { useState } from "react";
import { CalendarCheck, Download, ExternalLink, FileCheck2, Loader2, MapPin } from "lucide-react";
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

type OfficialEformEvidence = NonNullable<NonNullable<KrSubmissionResult["manualAction"]>["evidence"]>;

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
  const defaultOfficialMessage = isZh
    ? "官方 e-Form 需要通过 Korea Visa Portal 生成带条码 PDF。若官网要求人工选择馆别、上传文件或验证，请在官方页面完成后再回到 VIZA 下载。"
    : "The official barcode e-Form must be generated through Korea Visa Portal. If the portal asks for post selection, uploads, or verification, complete it on the official page and return to VIZA for download.";
  const [officialMessage, setOfficialMessage] = useState<string | null>(result.manualAction ? defaultOfficialMessage : null);
  const [officialEvidence, setOfficialEvidence] = useState<OfficialEformEvidence | null>(result.manualAction?.evidence ?? null);
  const [officialError, setOfficialError] = useState<string | null>(null);
  const currentPdfUrl = `/api/applications/${applicationId}/kr-annex17-pdf`;
  const downloadUrl = result.annex17PdfUrl?.includes(`/api/applications/${applicationId}/`)
    ? result.annex17PdfUrl
    : currentPdfUrl;
  const officialPortalUrl = result.officialEformPortalUrl ?? "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

  const requestOfficialEform = async () => {
    if (busy) return;
    setBusy(true);
    setOfficialError(null);
    setOfficialMessage(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/korea-official-eform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        officialEformPdfStoragePath?: string | null;
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
      setOfficialPath(payload?.officialEformPdfStoragePath ?? null);
      setOfficialStatus(normalizeOfficialEformStatus(payload?.status ?? "manual_action_required"));
      setOfficialMessage(payload?.manualAction?.instructions ?? defaultOfficialMessage);
      setOfficialEvidence(payload?.manualAction?.evidence ?? null);
    } catch (error) {
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
      const response = await fetch(`/api/applications/${applicationId}/artifact-url?path=${encodeURIComponent(officialPath)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.error ?? `Request failed: ${response.status}`);
      window.open(payload.url, "_blank", "noopener,noreferrer");
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
          <li>{isZh ? "如官网不支持所选领区，再使用 Annex-17 备用表格并人工确认。" : "Use the Annex-17 fallback only if the portal does not support the selected post."}</li>
          <li>{isZh ? "在推荐 KVAC 中心选择预约时间，按确认单携带材料递交。" : "Choose an appointment at the recommended KVAC center and bring the confirmation plus documents."}</li>
        </ol>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3 text-sm">
          <div className="font-medium text-foreground">
            {officialPath
              ? isZh ? "官方 e-Form PDF 已可下载" : "Official e-Form PDF is ready"
              : isZh ? "需要生成官方 e-Form PDF" : "Official e-Form PDF required"}
          </div>
          {officialMessage ? <p className="mt-1 leading-6 text-muted-foreground">{officialMessage}</p> : null}
          {officialError ? <p className="mt-1 text-red-600">{officialError}</p> : null}
          {officialEvidence?.screenshotPath ? (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {isZh ? "官网填写截图：" : "Official fill screenshot:"}{" "}
              <a
                className="underline underline-offset-2"
                href={`/api/applications/${applicationId}/korea-evidence?path=${encodeURIComponent(officialEvidence.screenshotPath)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {isZh ? "查看证据" : "View evidence"}
              </a>
            </p>
          ) : null}
          {officialEvidence?.missingUploads?.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isZh ? "仍需上传：" : "Still needs upload:"} {officialEvidence.missingUploads.join(", ")}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={officialPath ? downloadOfficialEform : requestOfficialEform} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {officialPath
                ? isZh ? "下载官方 e-Form PDF" : "Download official e-Form PDF"
                : isZh ? "生成官方 e-Form" : "Generate official e-Form"}
            </Button>
            <Button asChild variant="outline">
              <a href={officialPortalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {isZh ? "打开 Korea Visa Portal" : "Open Korea Visa Portal"}
              </a>
            </Button>
          </div>
          {officialStatus && officialStatus !== "ready" ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {isZh ? "当前状态：" : "Current status:"} {officialStatus}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              {isZh ? "备用 Annex-17 PDF" : "Fallback Annex-17 PDF"}
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/client/applications/${applicationId}/korea-appointment`}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              {isZh ? "预约 KVAC 时间" : "Book KVAC appointment"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
