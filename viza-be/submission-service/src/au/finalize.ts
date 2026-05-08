import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";

/**
 * Australia post-payment finalisation (AUTO-AU-03).
 *
 * AU is two-step like UK: applicants get a TRN + acknowledgement at
 * payment, but the grant letter arrives via email later. So we flip
 * to `submitted_to_government` here; a separate inbound-email
 * processor flips to `delivered` on grant-letter arrival.
 */

export interface PersistAuSubmittedInput {
  applicationId: string;
  applicantId: string;
  jobId: string;
  trn: string | null;
  pdfBytes: Buffer | Uint8Array;
}

export interface PersistAuSubmittedResult {
  storagePath: string;
  signedUrl: string;
  applicationStatus: "submitted_to_government";
}

export async function persistAuSubmitted(
  input: PersistAuSubmittedInput,
): Promise<PersistAuSubmittedResult> {
  const ref = await artifact.put(input.jobId, "au-acknowledgement.pdf", input.pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { error: docErr } = await supabase.from("application_documents").insert({
    application_id: input.applicationId,
    kind: "submission_acknowledgement_pdf",
    storage_path: ref.path,
    metadata: { trn: input.trn, source: "au_runner" },
  });
  if (docErr) throw new Error(`application_documents insert: ${docErr.message}`);

  const { error: appErr } = await supabase
    .from("applications")
    .update({ status: "submitted_to_government", trn: input.trn, updated_at: new Date().toISOString() })
    .eq("id", input.applicationId);
  if (appErr) throw new Error(`application status update: ${appErr.message}`);

  try {
    await supabase.from("notification_event_log").insert({
      applicant_id: input.applicantId,
      application_id: input.applicationId,
      event: "grant_pending",
      channel: "queued",
      outcome: "queued",
    });
  } catch (err) {
    console.error(`[au-finalize] notify queue insert failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    storagePath: ref.path,
    signedUrl: ref.signedUrl,
    applicationStatus: "submitted_to_government",
  };
}
