"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, Loader2, ShieldCheck } from "lucide-react";
import {
  abandonTakeover,
  claimTakeover,
  completeTakeover,
  getTakeoverRemoteDebugUrl,
} from "@/app/actions/takeover";
import { Button } from "@/components/ui/button";

interface Props {
  takeoverId: string;
  status: string;
  claimedByCurrentUser: boolean;
  copy: {
    claim: string;
    reveal: string;
    secureSession: string;
    complete: string;
    abandon: string;
    notes: string;
    answers: string;
    answerHelp: string;
    abandonReason: string;
  };
}

function parseAnswers(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Answers JSON must be an object.");
    }
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") throw new Error(`Answer ${key} must be a string.`);
      values[key] = value;
    }
    return values;
  }
  const values: Record<string, string> = {};
  for (const line of trimmed.split("\n")) {
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Invalid answer line: ${line}`);
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

export function TakeoverControls({ takeoverId, status, claimedByCurrentUser, copy }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [answers, setAnswers] = useState("");
  const [notes, setNotes] = useState("");
  const [abandonReason, setAbandonReason] = useState("");

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Operation failed");
      }
    });
  }

  const isClosed = status === "completed" || status === "abandoned";

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!isClosed && status === "queued" ? (
        <Button onClick={() => run(() => claimTakeover(takeoverId))} disabled={pending} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {copy.claim}
        </Button>
      ) : null}

      {!isClosed && claimedByCurrentUser ? (
        <>
          <div className="rounded-lg border border-[#e5e7eb] bg-[#fafbfc] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#334155]">{copy.secureSession}</p>
                <p className="text-xs text-[#64748b]">2FA/AAL2 required; every reveal is audited.</p>
              </div>
              <Button variant="outline" onClick={() => run(async () => {
                const result = await getTakeoverRemoteDebugUrl(takeoverId);
                setUrl(result.url);
                setVncUrl(result.vncUrl);
              })} disabled={pending} className="gap-2">
                <Eye className="h-4 w-4" />{copy.reveal}
              </Button>
            </div>
            {url ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[#232323] px-3 py-2 text-sm font-semibold text-white">
                  CDP <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {vncUrl ? <a href={vncUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold">VNC <ExternalLink className="h-3.5 w-3.5" /></a> : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <h3 className="font-semibold text-emerald-900">{copy.complete}</h3>
              <label className="mt-3 block text-xs font-medium text-emerald-900">
                {copy.answers}
                <textarea value={answers} onChange={(event) => setAnswers(event.target.value)} rows={5} placeholder={copy.answerHelp} className="mt-1 w-full rounded-md border border-emerald-200 bg-white p-2 font-mono text-xs" />
              </label>
              <label className="mt-3 block text-xs font-medium text-emerald-900">
                {copy.notes}
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-emerald-200 bg-white p-2 text-sm" />
              </label>
              <Button className="mt-3 bg-emerald-700 hover:bg-emerald-800" disabled={pending} onClick={() => run(async () => {
                await completeTakeover(takeoverId, parseAnswers(answers), notes);
              })}>{copy.complete}</Button>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/40 p-4">
              <h3 className="font-semibold text-red-900">{copy.abandon}</h3>
              <label className="mt-3 block text-xs font-medium text-red-900">
                {copy.abandonReason}
                <textarea value={abandonReason} onChange={(event) => setAbandonReason(event.target.value)} rows={5} required className="mt-1 w-full rounded-md border border-red-200 bg-white p-2 text-sm" />
              </label>
              <Button variant="destructive" className="mt-3" disabled={pending || !abandonReason.trim()} onClick={() => run(() => abandonTakeover(takeoverId, abandonReason.trim()))}>{copy.abandon}</Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
