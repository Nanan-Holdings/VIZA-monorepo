import type { Page } from "@playwright/test";
import { supabase } from "../supabase.js";
import {
  readTwOfficialReceiptEvidence,
  type TwOfficialReceiptEvidence,
} from "./receipt.js";

export interface TwApplicantHandoffRegistration {
  takeoverId: string;
  expiresAt: string;
}

export async function registerTwApplicantHandoff(input: {
  jobId: string;
  applicationId: string;
  applicantId: string;
  browserbaseSessionId: string;
  liveViewUrl: string;
  expiresAt: string;
}): Promise<TwApplicantHandoffRegistration> {
  await supabase
    .from("takeover_session")
    .update({
      status: "abandoned",
      operator_notes: "superseded_by_new_taiwan_applicant_handoff",
      closed_at: new Date().toISOString(),
    })
    .eq("application_id", input.applicationId)
    .eq("handoff_kind", "taiwan_applicant_final_submit")
    .in("status", ["queued", "claimed"]);

  const { data, error } = await supabase
    .from("takeover_session")
    .insert({
      job_id: input.jobId,
      application_id: input.applicationId,
      applicant_id: input.applicantId,
      status: "queued",
      reason: "Taiwan form is filled and waiting for the applicant's final official submission",
      remote_debug_url: `browserbase-session:${input.browserbaseSessionId}`,
      vnc_url: input.liveViewUrl,
      handoff_kind: "taiwan_applicant_final_submit",
      expires_at: input.expiresAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`taiwan applicant handoff insert failed: ${error?.message ?? "unknown"}`);

  await supabase.from("takeover_action_log").insert({
    takeover_id: data.id,
    action: "open",
    detail: { kind: "taiwan_applicant_final_submit", expiresAt: input.expiresAt },
  });

  return { takeoverId: data.id as string, expiresAt: input.expiresAt };
}

export async function waitForTwApplicantSubmission(input: {
  page: Page;
  takeoverId: string;
  expiresAt: string;
  pollMs?: number;
}): Promise<TwOfficialReceiptEvidence> {
  const pollMs = input.pollMs ?? 1_500;
  const deadline = new Date(input.expiresAt).getTime();

  while (Date.now() < deadline) {
    const receipt = await readTwOfficialReceiptEvidence(input.page).catch(() => null);
    if (receipt?.caseNumber) {
      await supabase
        .from("takeover_session")
        .update({ status: "completed", closed_at: receipt.capturedAt })
        .eq("id", input.takeoverId);
      await supabase.from("takeover_action_log").insert({
        takeover_id: input.takeoverId,
        action: "complete",
        detail: { kind: "taiwan_applicant_final_submit", officialReceiptCaptured: true },
      });
      return receipt;
    }
    await input.page.waitForTimeout(pollMs);
  }

  await supabase
    .from("takeover_session")
    .update({
      status: "abandoned",
      operator_notes: "applicant_handoff_expired_before_official_receipt",
      closed_at: new Date().toISOString(),
    })
    .eq("id", input.takeoverId);
  throw new Error("Taiwan applicant handoff expired before official receipt evidence was captured");
}
