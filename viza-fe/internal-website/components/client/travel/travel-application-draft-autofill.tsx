"use client";

import { useState } from "react";
import { CheckCircle, CircleNotch, FileArrowDown, ShieldCheck } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { TravelState } from "@/lib/travel/planner";

type DraftResponse = {
  error?: string;
  planDigest?: string;
  blockers?: string[];
  applicationCount?: number;
  fillableApplications?: number;
  fillableFields?: number;
  savedFields?: number;
  updatedApplications?: number;
};

async function send(body: Record<string, unknown>): Promise<DraftResponse> {
  const response = await fetch("/api/travel/application-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as DraftResponse;
  if (!response.ok) throw new Error(payload.error || "Unable to prepare application drafts.");
  return payload;
}

export function TravelApplicationDraftAutofill({
  interfaceLocale,
  travelState,
}: {
  interfaceLocale: "zh" | "en";
  travelState: TravelState;
}) {
  const zh = interfaceLocale === "zh";
  const [preview, setPreview] = useState<DraftResponse | null>(null);
  const [saved, setSaved] = useState<DraftResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepare = async () => {
    setBusy("preview");
    setError(null);
    setSaved(null);
    setConfirmed(false);
    try {
      setPreview(await send({ mode: "preview", state: travelState }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!preview?.planDigest || !confirmed) return;
    setBusy("commit");
    setError(null);
    try {
      setSaved(await send({
        mode: "commit",
        state: travelState,
        planDigest: preview.planDigest,
        confirmIntendedTravel: true,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-[24px] border border-[#AABFDF] bg-[#EEF3FA] px-5 py-5 text-[#01214A]" data-testid="travel-application-draft-autofill">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#03346E]">
            <FileArrowDown className="h-5 w-5" />
            {zh ? "一键生成申请草稿" : "One-click application drafts"}
          </p>
          <h3 className="mt-2 text-xl font-bold">
            {zh ? "把已确认的行程资料填入所有适用的 VIZA 表格" : "Fill every applicable VIZA form from confirmed trip facts"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#52657A]">
            {zh
              ? "只填写空白字段，不覆盖现有答案。估算航班、占位酒店、申报答案和护照资料不会自动生成；官网提交与付款不会启动。"
              : "Only empty fields are filled. Estimated flights, placeholder hotels, declarations, and passport facts are excluded; government submission and payment do not start."}
          </p>
        </div>
        <Button className="rounded-full bg-[#03346E] px-5 text-white hover:bg-[#022B5C]" disabled={busy !== null} onClick={prepare} type="button">
          {busy === "preview" ? <CircleNotch className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {zh ? "检查并生成" : "Check and generate"}
        </Button>
      </div>

      {error && <Alert className="mt-4" variant="destructive"><AlertIcon /><AlertDescription>{error}</AlertDescription></Alert>}

      {preview && !saved && (
        <div className="mt-4 rounded-2xl bg-white/85 p-4">
          <p className="text-sm font-semibold">
            {zh
              ? `共检查 ${preview.applicationCount ?? 0} 个申请；可向 ${preview.fillableApplications ?? 0} 个申请写入 ${preview.fillableFields ?? 0} 个空白字段。`
              : `Checked ${preview.applicationCount ?? 0} applications; ${preview.fillableFields ?? 0} empty fields across ${preview.fillableApplications ?? 0} applications can be filled.`}
          </p>
          {(preview.blockers?.length ?? 0) > 0 ? (
            <Alert className="mt-3" variant="destructive"><AlertIcon /><AlertDescription>{preview.blockers?.join(" ")}</AlertDescription></Alert>
          ) : (
            <>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6">
                <input checked={confirmed} className="mt-1 h-4 w-4 accent-[#03346E]" onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
                <span>{zh
                  ? "我确认这份固定日期行程是我的真实拟定行程，并同意把其中已核实的航班和住宿资料保存为 VIZA 申请草稿。"
                  : "I confirm this fixed-date itinerary is my genuinely intended travel and approve saving its verified flight and accommodation facts as VIZA application drafts."}</span>
              </label>
              <Button className="mt-4 rounded-full" disabled={!confirmed || busy !== null || (preview.fillableFields ?? 0) === 0} onClick={commit} type="button">
                {busy === "commit" && <CircleNotch className="h-4 w-4 animate-spin" />}
                {zh ? "确认并填写草稿" : "Confirm and fill drafts"}
              </Button>
            </>
          )}
        </div>
      )}

      {saved && (
        <Alert className="mt-4"><AlertIcon><CheckCircle className="h-5 w-5" /></AlertIcon><AlertDescription>
          {zh
            ? `已向 ${saved.updatedApplications ?? 0} 个申请保存 ${saved.savedFields ?? 0} 个草稿字段。官网提交与付款均未启动。`
            : `Saved ${saved.savedFields ?? 0} draft fields across ${saved.updatedApplications ?? 0} applications. Government submission and payment were not started.`}
        </AlertDescription></Alert>
      )}
    </section>
  );
}
