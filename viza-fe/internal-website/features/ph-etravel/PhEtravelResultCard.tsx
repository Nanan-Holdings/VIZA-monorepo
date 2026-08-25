"use client";

import { useLocale } from "next-intl";
import {
  ArrowSquareOut as ExternalLink,
  CheckCircle,
  Download,
  ImageSquare,
} from "@phosphor-icons/react";
import type { DigitalArrivalCardSubmissionResult } from "@/lib/submission-result";
import { isChineseLocale } from "@/lib/i18n/locale";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSubmissionConfirmationEvidence,
} from "@/app/client/application/_components/result-cards/SubmissionConfirmationEvidence";

function artifactUrl(
  applicationId: string,
  path: string,
  filename: string,
  inline = false,
): string {
  const params = new URLSearchParams({ path, download: filename });
  if (inline) params.set("inline", "1");
  return `/api/applications/${encodeURIComponent(applicationId)}/submission-artifact?${params.toString()}`;
}

export function PhEtravelResultCard({
  result,
  embedded = false,
}: {
  result: DigitalArrivalCardSubmissionResult;
  /** The application page supplies the surrounding Application status panel. */
  embedded?: boolean;
}) {
  const isZh = isChineseLocale(useLocale());
  const referenceNumber = result.issueNumber ?? result.referenceNumber ?? result.confirmationNumber;
  const qrPath = result.artifacts?.qrCodes?.[0] ?? null;
  const qrFilename = `philippines-etravel-${referenceNumber ?? result.applicationId}-qr.png`;
  const qrUrl = qrPath
    ? artifactUrl(result.applicationId, qrPath, qrFilename, true)
    : null;
  const confirmationEvidence = getSubmissionConfirmationEvidence(result);
  const confirmationImageFilename = `philippines-etravel-${referenceNumber ?? result.applicationId}-confirmation.png`;
  const confirmationImageUrl = confirmationEvidence
    ? artifactUrl(
        result.applicationId,
        confirmationEvidence.screenshotPath,
        confirmationImageFilename,
        true,
      )
    : null;

  const content = (
    <div className="space-y-3">
      <div role="status" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CheckCircle className="mt-0.5 size-5 shrink-0 text-emerald-600" weight="fill" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {isZh ? "菲律宾 eTravel" : "Philippines eTravel"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {isZh
                ? "您的 eTravel 登记已提交，并已通过菲律宾官方 eTravel 记录核验。"
                : "Your eTravel registration has been submitted and verified against the official Philippines eTravel record."}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          {isZh ? "已提交" : "Submitted"}
        </span>
      </div>

      {qrUrl || confirmationImageUrl ? (
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          {qrUrl ? (
            <section
              aria-label={isZh ? "官方 eTravel 二维码" : "Official eTravel QR code"}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-input bg-white"
            >
              <div className="flex min-h-44 flex-col p-5">
                <h4 className="text-base font-semibold text-foreground">
                  {isZh ? "官方 eTravel 二维码" : "Official eTravel QR code"}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isZh
                    ? "抵达菲律宾时，请准备出示此二维码和护照。二维码与下方登记参考号相对应。"
                    : "Keep this QR code with your passport for arrival in the Philippines. It is linked to the registration reference below."}
                </p>
                {referenceNumber ? (
                  <dl className="mt-auto pt-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {isZh ? "登记参考号" : "Registration reference"}
                    </dt>
                    <dd className="mt-1 break-all font-mono text-base font-semibold text-foreground">
                      {referenceNumber}
                    </dd>
                  </dl>
                ) : null}
              </div>
              <a
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isZh ? "查看菲律宾 eTravel 官方二维码" : "View the Philippines eTravel official QR code"}
                className="flex h-80 items-center justify-center border-y border-input bg-[#f6f7f8] p-6 md:h-96"
              >
                <img
                  src={qrUrl}
                  alt={isZh ? "菲律宾 eTravel 官方二维码" : "Philippines eTravel official QR code"}
                  className="size-56 max-h-full max-w-full rounded-md bg-white object-contain p-2"
                />
              </a>
              <div className="mt-auto p-4">
                <ActionButton asChild variant="secondary" size="sm" className="w-full">
                  <a href={qrUrl} download={qrFilename}>
                    <Download />
                    {isZh ? "下载官方二维码" : "Download official QR code"}
                  </a>
                </ActionButton>
              </div>
            </section>
          ) : null}

          {confirmationImageUrl && confirmationEvidence ? (
            <section
              aria-label={isZh ? "官方登记确认" : "Official registration confirmation"}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-input bg-white"
            >
              <div className="min-h-44 p-5">
                <h4 className="text-base font-semibold text-foreground">
                  {isZh ? "官方登记确认" : "Official registration confirmation"}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isZh
                    ? "这是提交后保存的菲律宾 eTravel 官方确认记录。请下载 PDF 留存，以便在旅途中随时查阅。"
                    : "This is the official Philippines eTravel confirmation saved after submission. Download the PDF and keep it available during your trip."}
                </p>
              </div>
              <a
                href={confirmationImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isZh ? "查看完整官方登记确认" : "View the full official registration confirmation"}
                className="flex h-80 items-center justify-center border-y border-input bg-[#f6f7f8] p-4 md:h-96"
              >
                <img
                  src={confirmationImageUrl}
                  alt={isZh ? "官网确认页截图" : "Official confirmation page screenshot"}
                  className="h-full w-full object-contain"
                />
              </a>
              <div className="mt-auto space-y-2 p-4">
                {confirmationEvidence.pdfPaths.length > 0 ? (
                  confirmationEvidence.pdfPaths.map((path, index) => {
                    const filename = confirmationEvidence.pdfPaths.length === 1
                      ? `philippines-etravel-${referenceNumber ?? result.applicationId}.pdf`
                      : `philippines-etravel-${referenceNumber ?? result.applicationId}-${index + 1}.pdf`;
                    return (
                      <ActionButton key={path} asChild variant="secondary" size="sm" className="w-full">
                        <a href={artifactUrl(result.applicationId, path, filename)} download={filename}>
                          <Download />
                          {confirmationEvidence.pdfPaths.length === 1
                            ? (isZh ? "下载确认 PDF" : "Download confirmation PDF")
                            : (isZh ? `下载确认 PDF ${index + 1}` : `Download confirmation PDF ${index + 1}`)}
                        </a>
                      </ActionButton>
                    );
                  })
                ) : (
                  <ActionButton asChild variant="secondary" size="sm" className="w-full">
                    <a href={confirmationImageUrl} target="_blank" rel="noopener noreferrer">
                      <ImageSquare />
                      {isZh ? "查看完整确认记录" : "View full confirmation"}
                    </a>
                  </ActionButton>
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <ActionButton asChild variant="primary" className="w-full">
        <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
          {isZh ? "打开菲律宾 eTravel 官方网站" : "Open the official Philippines eTravel website"}
          <ExternalLink />
        </a>
      </ActionButton>

      <p className="text-xs leading-5 text-muted-foreground">
        {isZh
          ? "菲律宾 eTravel 免费，不是签证，也不保证边检准入。"
          : "Philippines eTravel is free, is not a visa, and does not guarantee admission at border control."}
      </p>
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <CardTitle>{isZh ? "申请状态" : "Application status"}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
