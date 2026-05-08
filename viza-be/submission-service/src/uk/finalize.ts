import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";

/**
 * UK Standard Visitor visa post-payment finalisation (AUTO-UK-03).
 *
 * UK doesn't issue a PDF at the online stage — applicants get a
 * GWF reference + biometrics-appointment instructions. The "PDF"
 * we persist here is the application-summary printout the portal
 * makes available; the actual visa vignette is collected at VAC.
 */

export interface PersistUkSubmittedInput {
  applicationId: string;
  applicantId: string;
  jobId: string;
  reference: string | null;
  pdfBytes: Buffer | Uint8Array;
}

export interface PersistUkSubmittedResult {
  storagePath: string;
  signedUrl: string;
  applicationStatus: "submitted_to_government";
}

export async function persistUkSubmitted(
  input: PersistUkSubmittedInput,
): Promise<PersistUkSubmittedResult> {
  const ref = await artifact.put(input.jobId, "uk-application-summary.pdf", input.pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { error: docErr } = await supabase.from("application_documents").insert({
    application_id: input.applicationId,
    kind: "submission_summary_pdf",
    storage_path: ref.path,
    metadata: { reference: input.reference, source: "uk_runner" },
  });
  if (docErr) throw new Error(`application_documents insert: ${docErr.message}`);

  const { error: appErr } = await supabase
    .from("applications")
    .update({ status: "submitted_to_government", updated_at: new Date().toISOString() })
    .eq("id", input.applicationId);
  if (appErr) throw new Error(`application status update: ${appErr.message}`);

  try {
    await supabase.from("notification_event_log").insert({
      applicant_id: input.applicantId,
      application_id: input.applicationId,
      event: "biometrics_pending",
      channel: "queued",
      outcome: "queued",
    });
  } catch (err) {
    console.error(`[uk-finalize] notify queue insert failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    storagePath: ref.path,
    signedUrl: ref.signedUrl,
    applicationStatus: "submitted_to_government",
  };
}
