"use client";

import { CalendarCheck, Download, FileCheck2, MapPin } from "lucide-react";
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

export function KrResultCard({ applicationId, result }: KrResultCardProps) {
  const isZh = isChineseLocale(useLocale());
  const fallbackCenter = resolveKvacCenter({}).recommended;
  const center = result.recommendedCenter ?? fallbackCenter;
  const currentPdfUrl = `/api/applications/${applicationId}/kr-annex17-pdf`;
  const downloadUrl = result.annex17PdfUrl?.includes(`/api/applications/${applicationId}/`)
    ? result.annex17PdfUrl
    : currentPdfUrl;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <FileCheck2 className="h-5 w-5 text-brand-500" />
            {isZh ? "韩国 C-3-9 申请表已生成" : "Korea C-3-9 form is ready"}
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
          <li>{isZh ? "下载并打印已填写的 Annex-17 韩国签证申请表。" : "Download and print the filled Annex-17 visa application form."}</li>
          <li>{isZh ? "贴 35x45mm 白底照片，并在纸表上签名。" : "Attach a 35x45mm white-background photo and sign the paper form."}</li>
          <li>{isZh ? "在推荐 KVAC 中心选择预约时间，按确认单携带材料递交。" : "Choose an appointment at the recommended KVAC center and bring the confirmation plus documents."}</li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              {isZh ? "下载申请表 PDF" : "Download Annex-17 PDF"}
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
