"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowSquareOut as ExternalLink } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { completeKoreaEArrivalCardPreflight } from "@/app/actions/visa-application-answers";
import {
  ageAtSeoulDate,
  canContinueKoreaArrivalPreflight,
  KOREA_ARRIVAL_PREFLIGHT_STORAGE_KEY,
  type KoreaArrivalEligibility,
  type KoreaArrivalPreflightMarker,
} from "./eligibility";
import { buildKoreaArrivalCardFormHref } from "@/features/kr-arrival-card/routes";

const KOREA_NAVIGATOR_URL = "https://www.e-arrivalcard.go.kr/portal/guide/eacTargetGuide.do";

export type KoreaArrivalCardPreflightCompletion = {
  applicationId: string;
  answers: Record<string, string>;
  marker: KoreaArrivalPreflightMarker;
};

export function KoreaArrivalCardEligibilityGate({
  applicationId,
  onComplete,
}: {
  applicationId?: string | null;
  onComplete?: (completion: KoreaArrivalCardPreflightCompletion) => void | Promise<void>;
} = {}) {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const repeatApplicationId = applicationId?.trim() || searchParams.get("applicationId")?.trim() || null;
  const isZh = locale.toLowerCase().startsWith("zh");
  const [eligibility, setEligibility] = useState<KoreaArrivalEligibility | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [adultRepresentativeConfirmed, setAdultRepresentativeConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const age = useMemo(() => ageAtSeoulDate(dateOfBirth), [dateOfBirth]);
  const minorNeedsRepresentative = age !== null && age < 14;
  const blockedExempt = eligibility === "exempt";
  const uncertain = eligibility === "uncertain";
  const canContinue = canContinueKoreaArrivalPreflight({
    eligibility,
    dateOfBirth,
    adultRepresentativeConfirmed,
  });

  const continueToForm = async () => {
    if (!canContinue || eligibility !== "needs_declaration") return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await completeKoreaEArrivalCardPreflight({
        applicationId: repeatApplicationId,
        dateOfBirth,
        adultRepresentativeConfirmed,
      });
      if (!result.ok || !result.applicationId || !result.completedAt || !result.answers) {
        setSaveError(
          isZh
            ? "暂时无法保存资格预检，请重试。你已填写的内容仍然保留。"
            : "We could not save the eligibility check. Try again; your answers are still here.",
        );
        return;
      }
      const marker: KoreaArrivalPreflightMarker = {
        version: 1,
        country: "south_korea",
        visaType: "KR_E_ARRIVAL_CARD",
        eligibility: "needs_declaration",
        adultRepresentative: minorNeedsRepresentative,
        completedAt: result.completedAt,
      };
      window.sessionStorage.setItem(KOREA_ARRIVAL_PREFLIGHT_STORAGE_KEY, JSON.stringify(marker));
      const completion: KoreaArrivalCardPreflightCompletion = {
        applicationId: result.applicationId,
        answers: result.answers,
        marker,
      };
      if (onComplete) {
        await onComplete(completion);
        return;
      }
      router.push(buildKoreaArrivalCardFormHref({
        adultRepresentative: minorNeedsRepresentative,
        applicationId: result.applicationId,
      }));
    } catch {
      setSaveError(
        isZh
          ? "暂时无法保存资格预检，请重试。你已填写的内容仍然保留。"
          : "We could not save the eligibility check. Try again; your answers are still here.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full rounded-2xl border-input shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle>{isZh ? "韩国 e-Arrival Card 资格预检" : "Korea e-Arrival Card eligibility check"}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            {isZh
              ? "韩国电子入境卡与签证、K-ETA 分开。请先按你的入境身份选择；资格判断不会作为官方字段提交，出生日期会自动带入后续表单。"
              : "The Korea e-Arrival Card is separate from a visa and K-ETA. Choose the statement that matches your entry status. The eligibility result is not submitted as an official field; your date of birth carries into the form."}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {isZh ? "官方规则审核于 2026-08-18。" : "Official rules reviewed 2026-08-18."}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">
              {isZh ? "你是否需要提交入境申报？" : "Do you need to submit an arrival declaration?"}
            </legend>
            {([
              {
                value: "needs_declaration" as const,
                label: isZh ? "需要申报：持韩国签证入境，或属于 K-ETA 豁免情形" : "I need to declare: I enter with a Korean visa or fall under a K-ETA-exempt case",
              },
              {
                value: "exempt" as const,
                label: isZh ? "明确豁免：我有有效 K-ETA、韩国居民证件、韩国国籍，或属于机组等豁免类别" : "I am clearly exempt: I have a valid K-ETA, Korean resident document, Korean nationality, or a crew/other exempt status",
              },
              {
                value: "uncertain" as const,
                label: isZh ? "不确定：我需要先查看官方适用对象说明" : "I am unsure: I need to check the official eligibility guidance first",
              },
            ]).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm leading-5 transition-colors",
                  eligibility === option.value ? "border-brand-500 bg-brand-50" : "border-input hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="korea-arrival-eligibility"
                  value={option.value}
                  checked={eligibility === option.value}
                  onChange={() => {
                    setEligibility(option.value);
                  }}
                  className="mt-1"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="korea-arrival-date-of-birth" className="text-sm font-semibold text-foreground">
              {isZh ? "出生日期（用于判断 14 岁以下代填要求）" : "Date of birth (used only to check the under-14 representative rule)"}
            </label>
            <input
              id="korea-arrival-date-of-birth"
              type="date"
              value={dateOfBirth}
              onChange={(event) => {
                setDateOfBirth(event.target.value);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {minorNeedsRepresentative ? (
              <label className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                <input
                  type="checkbox"
                  checked={adultRepresentativeConfirmed}
                  onChange={(event) => {
                    setAdultRepresentativeConfirmed(event.target.checked);
                  }}
                  className="mt-1"
                />
                <span>
                  {isZh
                    ? "我确认自己是该未满 14 岁旅客的成年监护人或获授权代表。"
                    : "I confirm that I am the adult guardian or authorised representative completing this declaration for a traveller under 14."}
                </span>
              </label>
            ) : null}
            {!dateOfBirth ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {isZh ? "请先填写有效出生日期，再继续。" : "Enter a valid date of birth before continuing."}
              </p>
            ) : age === null ? (
              <p className="text-xs leading-5 text-destructive">
                {isZh ? "出生日期无效或晚于今天。" : "The date of birth is invalid or in the future."}
              </p>
            ) : null}
          </div>

          {blockedExempt ? (
            <Alert variant="info">
              <AlertIcon variant="info" />
              <AlertTitle>{isZh ? "无需创建入境卡申请" : "No arrival-card application was created"}</AlertTitle>
              <AlertDescription>
                {isZh
                  ? "你选择了明确豁免。请不要进入提交队列；如情况改变，请重新查看官方适用对象说明。"
                  : "You selected a clear exemption. No submission queue was created. Recheck the official eligibility guidance if your circumstances change."}
              </AlertDescription>
            </Alert>
          ) : null}

          {uncertain ? (
            <Alert variant="warning">
              <AlertIcon variant="warning" />
              <AlertTitle>{isZh ? "请先核对官方 Navigator" : "Check the official Navigator first"}</AlertTitle>
              <AlertDescription>
                {isZh
                  ? "我们不会根据不确定选项自动判定豁免。请查看官方适用对象说明；确认需要申报后，再继续填写。"
                  : "We will not infer an exemption from an uncertain answer. Check the official eligibility guidance, then continue only when you confirm that a declaration is needed."}
              </AlertDescription>
            </Alert>
          ) : null}

          {saveError ? (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={KOREA_NAVIGATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-brand-700 underline underline-offset-4"
            >
              {isZh ? "打开官方适用对象 Navigator" : "Open official eligibility Navigator"}
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
            <Button
              type="button"
              onClick={() => void continueToForm()}
              disabled={!canContinue || saving}
            >
              {saving
                ? (isZh ? "正在保存..." : "Saving...")
                : uncertain
                ? (isZh ? "查看官方说明后选择需要申报" : "Check the official guidance, then select declaration needed")
                : blockedExempt
                  ? (isZh ? "无需创建申请" : "No application needed")
                : isZh
                  ? "继续填写"
                  : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
