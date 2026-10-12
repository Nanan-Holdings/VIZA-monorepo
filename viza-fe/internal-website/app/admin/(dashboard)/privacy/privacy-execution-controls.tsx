"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eraser, ShieldCheck } from "lucide-react";
import {
  approvePrivacyErasure,
  executePrivacyErasure,
  generatePrivacyExport,
  getPrivacyExportUrl,
  preparePrivacyErasure,
} from "@/app/actions/admin-privacy";

export function PrivacyExecutionControls({
  requestId,
  requestType,
  exportPath,
  executionStatus,
  requestedByCurrentUser,
  copy,
}: {
  requestId: string;
  requestType: string;
  exportPath: string | null;
  executionStatus: string | null;
  requestedByCurrentUser: boolean;
  copy: {
    generateExport: string;
    downloadExport: string;
    prepareErasure: string;
    approveErasure: string;
    executeErasure: string;
    reason: string;
    typeConfirmation: string;
    secondAdmin: string;
    twoFactor: string;
    execution: string;
    commandFailed: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const isExport = ["export", "data_export", "personal_data_export", "access"].includes(requestType);
  const isErasure = ["deletion", "delete", "data_deletion", "erasure"].includes(requestType);

  function run(operation: () => Promise<{ success: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await operation();
      setMessage(result.success ? "✓" : result.error || copy.commandFailed);
      if (result.success) router.refresh();
    });
  }

  async function reveal() {
    setMessage(null);
    startTransition(async () => {
      const result = await getPrivacyExportUrl(requestId);
      if (!result.success) return setMessage(result.error);
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-[#d9dee7] bg-[#fafbfc] p-4">
      {executionStatus ? <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748b]">{copy.execution}: {executionStatus}</p> : null}
      {isExport ? <div className="flex flex-col gap-2 sm:flex-row"><form className="flex flex-1 gap-2" action={(formData) => run(() => generatePrivacyExport({ requestId, reason: String(formData.get("reason") || "") }))}><input name="reason" required minLength={5} placeholder={copy.reason} className="h-9 flex-1 rounded-md border px-3 text-sm" /><button disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white disabled:opacity-60"><Download className="h-4 w-4" />{copy.generateExport}</button></form>{exportPath ? <button type="button" disabled={pending} onClick={reveal} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border bg-white px-3 text-sm font-semibold text-[#334155]"><ShieldCheck className="h-4 w-4" />{copy.downloadExport}</button> : null}</div> : null}
      {isErasure ? <div className="space-y-3"><p className="text-xs leading-5 text-amber-800">{copy.secondAdmin} {copy.twoFactor}</p>{!executionStatus || ["blocked", "failed"].includes(executionStatus) ? <form className="flex gap-2" action={(formData) => run(() => preparePrivacyErasure({ requestId, reason: String(formData.get("reason") || "") }))}><input name="reason" required minLength={5} placeholder={copy.reason} className="h-9 flex-1 rounded-md border px-3 text-sm" /><button disabled={pending} className="inline-flex h-9 items-center gap-1 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800"><Eraser className="h-4 w-4" />{copy.prepareErasure}</button></form> : null}{executionStatus === "awaiting_approval" ? <form className="flex gap-2" action={(formData) => run(() => approvePrivacyErasure({ requestId, reason: String(formData.get("reason") || "") }))}><input name="reason" required minLength={5} placeholder={copy.reason} className="h-9 flex-1 rounded-md border px-3 text-sm" /><button disabled={pending || requestedByCurrentUser} className="h-9 rounded-md bg-brand-500 px-3 text-sm font-semibold text-white disabled:opacity-50">{copy.approveErasure}</button></form> : null}{executionStatus === "approved" ? <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" action={(formData) => run(() => executePrivacyErasure({ requestId, reason: String(formData.get("reason") || ""), confirmation: String(formData.get("confirmation") || "") }))}><input name="reason" required minLength={5} placeholder={copy.reason} className="h-9 rounded-md border px-3 text-sm" /><input name="confirmation" required placeholder={`${copy.typeConfirmation}: ERASE ${requestId}`} className="h-9 rounded-md border px-3 font-mono text-xs" /><button disabled={pending} className="h-9 rounded-md bg-red-700 px-3 text-sm font-semibold text-white">{copy.executeErasure}</button></form> : null}</div> : null}
      {message ? <p role="status" className={`mt-2 text-xs font-semibold ${message === "✓" ? "text-emerald-700" : "text-red-700"}`}>{message}</p> : null}
    </div>
  );
}
