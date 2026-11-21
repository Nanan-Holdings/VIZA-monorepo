"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  ArrowSquareOut,
  ArrowClockwise as RotateCw,
  CircleNotch as Loader2,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { isChineseLocale } from "@/lib/i18n/locale";
import { openOfficialHandoffWindow } from "./official-handoff-client";
import { OfficialCancelButton } from "./OfficialCancelButton";
import { IndonesiaOfficialSubmitGuide } from "./IndonesiaOfficialSubmitGuide";
import { VietnamOfficialSubmitGuide } from "./VietnamOfficialSubmitGuide";

/** Stored result written by open_official_applicant_handoff (migration 0209). */
export interface OfficialHandoffResult {
  status: "awaiting_applicant_official_submit";
  handoffId: string;
  handoffExpiresAt?: string;
  handoffExpired?: boolean;
  /** The official portal logged the session out before the handoff expired (0210). */
  officialSessionLost?: boolean;
  handoffReadyAt?: string;
  targetCountry?: string;
}

export function isOfficialHandoffResult(value: unknown): value is OfficialHandoffResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.status === "awaiting_applicant_official_submit" &&
    typeof record.handoffId === "string" &&
    record.handoffId.trim().length > 0
  );
}

const COUNTRY_NAME: Record<string, { en: string; zh: string }> = {
  ID: { en: "Indonesia", zh: "印尼" },
  VN: { en: "Vietnam", zh: "越南" },
};

export function OfficialHandoffResultCard({
  applicationId,
  result,
  onRegenerated,
}: {
  applicationId: string | null;
  result: OfficialHandoffResult;
  onRegenerated?: () => void;
}) {
  const isZh = isChineseLocale(useLocale());
  const [busy, setBusy] = useState<"open" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(
    Boolean(result.handoffExpired) ||
      (result.handoffExpiresAt ? Date.parse(result.handoffExpiresAt) <= Date.now() : false),
  );
  const name = COUNTRY_NAME[result.targetCountry ?? ""] ?? { en: "the official", zh: "官方" };
  const countryLabel = isZh ? name.zh : name.en;
  const paymentOnly = result.handoffReadyAt === "official_payment_pending";
  const expiresAtMs = result.handoffExpiresAt ? Date.parse(result.handoffExpiresAt) : Number.NaN;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (expired || !Number.isFinite(expiresAtMs)) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [expired, expiresAtMs]);
  const minutesLeft = Number.isFinite(expiresAtMs) ? Math.max(0, Math.ceil((expiresAtMs - nowMs) / 60_000)) : null;
  useEffect(() => {
    if (minutesLeft === 0) setExpired(true);
  }, [minutesLeft]);

  async function openOfficialSite() {
    if (!applicationId || busy) return;
    setBusy("open");
    setError(null);
    try {
      const outcome = await openOfficialHandoffWindow(applicationId);
      if (outcome === "expired") setExpired(true);
      if (outcome === "unavailable") {
        setError(
          isZh
            ? "官网会话暂时无法打开，请稍后再试或重新准备会话。"
            : "The official session could not be opened. Try again shortly or prepare a new session.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!applicationId || busy) return;
    setBusy("regenerate");
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/official-handoff/regenerate`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setError(
          isZh
            ? "现在无法重新准备官网会话。24 小时内最多可准备 3 次；如需帮助请联系支持团队。"
            : "A new official session can't be prepared right now. You can prepare up to 3 sessions in 24 hours; contact support if you need help.",
        );
        return;
      }
      // Status polling may have stopped on this user-action state; reload so
      // the page picks up the requeued job.
      if (onRegenerated) onRegenerated();
      else window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="rounded-xl border-input">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            {expired
              ? isZh ? "官网会话已过期" : "Official session expired"
              : isZh ? `前往${countryLabel}官网确认并提交` : `Review and submit on the ${countryLabel} official site`}
          </CardTitle>
          <Badge variant="secondary">{isZh ? "需要你操作" : "Your action"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {expired ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {result.officialSessionLost
                ? isZh
                  ? `${countryLabel}官网闲置一段时间后自动登出了，之前的官网页面已经不能用。`
                  : `The ${countryLabel} official site logged the session out after it sat idle, so the earlier page can no longer be used.`
                : null}
              {isZh
                ? "你的资料仍然保存在 VIZA。点击下方按钮，VIZA 会重新填写官网并准备一个新的会话，完成后这里会再次出现前往官网的按钮。"
                : "Your answers are still saved in VIZA. Prepare a new session and VIZA will fill the official site again; the button to open it will appear here when it's ready."}
            </p>
            <Button type="button" className="w-full" disabled={!applicationId || busy !== null} onClick={() => void regenerate()}>
              {busy === "regenerate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
              {isZh ? "重新准备官网会话" : "Prepare a new official session"}
            </Button>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">
              {paymentOnly ? (
                <>
                  <li>{isZh ? "申请已在官网提交，正在等待付款。" : "Your application is already submitted on the official site and waiting for payment."}</li>
                  <li>{isZh ? "在官网上用你自己的支付方式缴纳官方费用。" : "Pay the government fee on the official site with your own payment method."}</li>
                </>
              ) : (
                <>
                  <li>{isZh ? "打开的是 VIZA 已经帮你填好的官网申请页。" : "The page that opens is your official application, already filled in by VIZA."}</li>
                  <li>{isZh ? "逐项核对资料，勾选官网声明。" : "Check every answer and accept the official declarations yourself."}</li>
                  <li>{isZh ? "由你本人点击官网的提交按钮，并在官网缴纳官方费用。" : "Click the official Submit button and pay the government fee on the official site."}</li>
                </>
              )}
            </ol>
            {minutesLeft !== null ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {isZh
                  ? `请在 ${minutesLeft} 分钟内完成官网提交和付款，之后这个官网会话会失效。`
                  : `Finish submitting and paying on the official site within ${minutesLeft} minutes; the session closes after that.`}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isZh
                ? "VIZA 不收取任何费用，也不会替你提交或付款。提交后这里会自动更新为已提交。"
                : "VIZA charges nothing and never submits or pays for you. This page updates automatically once you submit."}
            </p>
            <Button type="button" className="w-full" disabled={!applicationId || busy !== null} onClick={() => void openOfficialSite()}>
              {busy === "open" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowSquareOut className="mr-2 h-4 w-4" />}
              {isZh ? `前往${countryLabel}官网确认并提交` : `Open the ${countryLabel} official site`}
            </Button>
            {result.targetCountry === "ID" ? <IndonesiaOfficialSubmitGuide isZh={isZh} /> : null}
            {result.targetCountry === "VN" ? <VietnamOfficialSubmitGuide isZh={isZh} /> : null}
          </>
        )}
        {error ? <ClientErrorAlert message={error} /> : null}
        {applicationId && !expired ? <OfficialCancelButton applicationId={applicationId} isZh={isZh} /> : null}
      </CardContent>
    </Card>
  );
}
