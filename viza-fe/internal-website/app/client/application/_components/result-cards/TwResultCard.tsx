"use client";

import { useLocale } from "next-intl";
import { Warning as AlertTriangle, ArrowSquareOut as ExternalLink, ShieldCheck } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isChineseLocale } from "@/lib/i18n/locale";
import type { TwSubmissionResult } from "@/lib/submission-result";

interface TwResultCardProps {
  result: TwSubmissionResult;
}

/**
 * TW_ENTRY_PERMIT result card. Taiwan has no persistent portal account (the
 * official site verifies email via a one-time OTP inline, not a registered
 * account) and no payment gate to halt before — the real NIA fee is only
 * payable after approval, in a separate later session on the official site.
 * So unlike UkResultCard, there is nothing to "pay" here: the automation
 * fills every field and stops right at the CAPTCHA + "確認資料" (confirm
 * data) submit button, and the applicant must open the portal themselves,
 * solve the CAPTCHA, and click submit.
 */
export function TwResultCard({ result }: TwResultCardProps) {
  const isZh = isChineseLocale(useLocale());

  if (result.status === "failed") {
    return (
      <Card className="rounded-xl border-input">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-foreground">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {isZh ? "台湾入境许可证自动填写未完成" : "Taiwan entry permit auto-fill did not complete"}
            </CardTitle>
            <Badge variant="secondary">{isZh ? "未完成" : "Not completed"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{result.error}</p>
          {result.url && (
            <Button asChild variant="outline" className="w-full">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                {isZh ? "打开官网" : "Open the official site"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {isZh ? "台湾入境许可证申请已填写完成" : "Your Taiwan entry permit application is filled out"}
          </CardTitle>
          <Badge variant="secondary">{isZh ? "待你输入验证码送出" : "Awaiting your CAPTCHA & submit"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isZh
            ? "我们已在移民署境外人士线上申办系统上，用你保存的答案自动填写完整份申请表，一路填到验证码页为止。图形验证码必须由你本人在官网现场输入，然后点击官网自己的「确认资料」按钮送出——这两步无法由程序代劳。"
            : "We've automatically filled out your entire Taiwan Online Entry Permit application on the National Immigration Agency's portal, using your saved answers, all the way up to the CAPTCHA step. You need to open the official site yourself, solve the CAPTCHA image, and click the site's own \"確認資料\" (confirm data) submit button — those two steps can't be automated."}
        </p>

        <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-start gap-2 text-sm leading-relaxed text-brand-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            <span>
              {isZh
                ? "台湾这项许可证没有和英国一样的「填完就付款」环节：真正要缴的移民署费用（单次证 NT$600 / 一年多次证 NT$1,000）要等审核核准之后，另外登录官网付款，跟这次填表完全是两次会话，本页不会要求你现在付款。"
                : "Unlike the UK flow, there is no \"pay now\" step here. The real NIA fee (NT$600 single-entry / NT$1,000 multiple-entry) is only payable after your application is approved, in a separate later login on the official site — this page will never ask you to pay now."}
            </span>
          </div>
        </div>

        {(result.pagesFilled?.length ?? 0) > 0 && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "已自动填写的部分" : "Sections filled automatically"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(result.pagesFilled ?? []).map((page) => (
                <Badge key={page} variant="outline" className="font-normal">
                  {page}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result.caseNumber && (
          <div className="rounded-md border border-input bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {isZh ? "申请案号（暂存号或收件号）" : "Application case number (temporary save or receipt number)"}
            </div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{result.caseNumber}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isZh
                ? "如果是 20 码，代表暂存进度；如果是 12 码，代表已由你送出并生成收件号。"
                : "A 20-digit code is a temporary save number; a 12-digit code means you already submitted and it's a receipt number."}
            </div>
          </div>
        )}

        {result.portalUrl && (
          <Button asChild className="w-full">
            <a href={result.portalUrl} target="_blank" rel="noopener noreferrer">
              {isZh ? "打开移民署官网，输入验证码并送出" : "Open the NIA portal, enter the CAPTCHA & submit"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
