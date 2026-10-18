"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createOutcomeUploadTarget,
  recordApplicationOutcome,
} from "@/app/actions/admin-staff-ops";
import type { InterfaceLocale } from "@/lib/i18n/locale";
import type { OutcomeKind } from "./outcome-transitions";

export interface OutcomePanelApplication {
  id: string;
  label: string;
  rawStatus: string;
  externalReference: string | null;
  resultStatus: string | null;
  resultNotes: string | null;
}

const COPY = {
  en: {
    title: "Record outcome",
    description:
      "Move the case forward. Each action updates the application, writes the status history and emails the applicant (English or Chinese by their language).",
    current: "Current status",
    reference: "Gov. reference",
    choose: "Outcome",
    kinds: {
      submitted: "Submitted to the government",
      approved: "Approved (attach visa / eTA / arrival card)",
      refused: "Refused",
      needs_info: "Needs more information from the applicant",
    } satisfies Record<OutcomeKind, string>,
    govReference: "Government reference number",
    submittedOn: "Date submitted",
    file: "Visa, eTA or arrival card (PDF or image)",
    refusalFile: "Refusal letter (optional)",
    reason: "Refusal reason (sent to the applicant)",
    message: "What the applicant needs to provide (sent as written)",
    save: "Save and email applicant",
    saving: "Saving",
    uploading: "Uploading file",
    emailed: (to: string | null) => `Saved. Email sent${to ? ` to ${to}` : ""}.`,
    notEmailed: (reason: string | null) => `Saved, but the email was not sent (${reason ?? "unknown"}).`,
  },
  zh: {
    title: "记录结果",
    description: "推进案件。每个操作都会更新申请状态、写入状态历史，并按申请人语言（中文或英文）邮件通知。",
    current: "当前状态",
    reference: "官方编号",
    choose: "结果",
    kinds: {
      submitted: "已向官方递交",
      approved: "已获批（上传签证 / eTA / 入境卡）",
      refused: "被拒签",
      needs_info: "需要申请人补充信息",
    } satisfies Record<OutcomeKind, string>,
    govReference: "官方申请编号",
    submittedOn: "递交日期",
    file: "签证、eTA 或入境卡文件（PDF 或图片）",
    refusalFile: "拒签信（可选）",
    reason: "拒签原因（将发送给申请人）",
    message: "申请人需要补充的内容（按原文发送）",
    save: "保存并邮件通知申请人",
    saving: "正在保存",
    uploading: "正在上传文件",
    emailed: (to: string | null) => `已保存，邮件已发送${to ? `至 ${to}` : ""}。`,
    notEmailed: (reason: string | null) => `已保存，但邮件未发送（${reason ?? "未知原因"}）。`,
  },
} as const;

const inputClass = "h-10 w-full rounded-md border border-[#d7dce3] bg-white px-3 text-sm";

function OutcomeForm({ application, locale }: { application: OutcomePanelApplication; locale: InterfaceLocale }) {
  const copy = COPY[locale];
  const router = useRouter();
  const [kind, setKind] = useState<OutcomeKind>("submitted");
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function uploadFile(file: File): Promise<string> {
    const target = await createOutcomeUploadTarget({
      applicationId: application.id,
      filename: file.name,
      contentType: file.type,
    });
    if (!target.ok) throw new Error(target.error);
    const { error } = await createClient()
      .storage.from(target.bucket)
      .uploadToSignedUrl(target.objectPath, target.token, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return target.storagePath;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(null);
    try {
      let resultStoragePath: string | null = null;
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        setStage("uploading");
        resultStoragePath = await uploadFile(file);
      }
      setStage("saving");
      const result = await recordApplicationOutcome(application.id, {
        kind,
        reference: String(form.get("reference") ?? ""),
        submittedOn: String(form.get("submittedOn") ?? ""),
        reason: String(form.get("reason") ?? ""),
        message: String(form.get("message") ?? ""),
        resultStoragePath,
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
      } else {
        setMessage({
          tone: result.emailed ? "ok" : "error",
          text: result.emailed ? copy.emailed(result.recipient) : copy.notEmailed(result.emailError),
        });
        startTransition(() => router.refresh());
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setStage("idle");
    }
  }

  const busy = stage !== "idle";
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="md:col-span-2 text-xs font-semibold text-[#475569]">
        {copy.choose}
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as OutcomeKind)}
          className={`${inputClass} mt-1`}
        >
          {(Object.keys(copy.kinds) as OutcomeKind[]).map((key) => (
            <option key={key} value={key}>{copy.kinds[key]}</option>
          ))}
        </select>
      </label>

      {kind === "submitted" ? (
        <>
          <label className="text-xs font-semibold text-[#475569]">
            {copy.govReference}
            <input name="reference" required maxLength={128} defaultValue={application.externalReference ?? ""} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-semibold text-[#475569]">
            {copy.submittedOn}
            <input name="submittedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputClass} mt-1`} />
          </label>
        </>
      ) : null}

      {kind === "approved" ? (
        <>
          <label className="text-xs font-semibold text-[#475569]">
            {copy.file}
            <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
          </label>
          <label className="text-xs font-semibold text-[#475569]">
            {copy.govReference}
            <input name="reference" maxLength={128} defaultValue={application.externalReference ?? ""} className={`${inputClass} mt-1`} />
          </label>
        </>
      ) : null}

      {kind === "refused" ? (
        <>
          <label className="md:col-span-2 text-xs font-semibold text-[#475569]">
            {copy.reason}
            <textarea name="reason" required maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-[#d7dce3] p-3 text-sm" />
          </label>
          <label className="md:col-span-2 text-xs font-semibold text-[#475569]">
            {copy.refusalFile}
            <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
          </label>
        </>
      ) : null}

      {kind === "needs_info" ? (
        <label className="md:col-span-2 text-xs font-semibold text-[#475569]">
          {copy.message}
          <textarea name="message" required maxLength={2000} rows={3} className="mt-1 w-full rounded-md border border-[#d7dce3] p-3 text-sm" />
        </label>
      ) : null}

      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {stage === "uploading" ? copy.uploading : stage === "saving" ? copy.saving : copy.save}
        </button>
        {message ? (
          <p role="status" className={`text-sm ${message.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>
            {message.tone === "ok" ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : null}
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function OutcomePanel({
  applications,
  locale,
}: {
  applications: OutcomePanelApplication[];
  locale: InterfaceLocale;
}) {
  const copy = COPY[locale];
  if (applications.length === 0) return null;
  return (
    <section className="rounded-lg border border-[#efefef] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#232323]">{copy.title}</h2>
      <p className="mt-1 text-sm text-[#64748b]">{copy.description}</p>
      <div className="mt-4 space-y-4">
        {applications.map((application) => (
          <div key={application.id} id={`outcome-${application.id}`} className="scroll-mt-24 rounded-lg border border-[#e5e7eb] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#334155]">{application.label}</span>
              <span className="text-xs text-[#64748b]">
                {copy.current}: <span className="font-mono">{application.rawStatus || "-"}</span>
                {application.resultStatus ? ` / ${application.resultStatus}` : ""}
                {application.externalReference ? ` · ${copy.reference}: ${application.externalReference}` : ""}
                {" · "}
                <span className="font-mono">{application.id.slice(0, 8)}</span>
              </span>
            </div>
            {application.resultNotes ? <p className="mt-2 text-sm text-[#64748b]">{application.resultNotes}</p> : null}
            <OutcomeForm application={application} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  );
}
