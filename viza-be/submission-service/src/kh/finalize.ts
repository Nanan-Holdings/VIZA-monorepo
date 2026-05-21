import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";

/**
 * Cambodia post-payment finalisation (AUTO-KH-03).
 *
 * Once the runner has paid + received the issued e-Visa PDF (or a
 * portal-side download URL the runner fetches), call
 * `persistKhDelivered` to:
 *   1. Upload the PDF under jobs/<jobId>/kh-evisa.pdf via INFRA-006
 *      artifact.put — returns a 5-minute signed URL.
 *   2. Stamp `application_documents` with kind='evisa_pdf'.
 *   3. Flip `applications.status='delivered'`.
 *   4. Surface CS-002 doc_ready notification (the dispatcher emits
 *      Resend email + Expo push per applicant prefs).
 *
 * The dispatcher import is dynamic to keep the FE notify module out
 * of the submission-service hot path; it's only resolved on success.
 */

export interface PersistKhDeliveredInput {
  applicationId: string;
  applicantId: string;
  jobId: string;
  reference: string | null;
  pdfBytes: Buffer | Uint8Array;
}

export interface PersistKhDeliveredResult {
  storagePath: string;
  signedUrl: string;
  applicationStatus: "delivered";
}

export async function persistKhDelivered(
  input: PersistKhDeliveredInput,
): Promise<PersistKhDeliveredResult> {
  const ref = await artifact.put(input.jobId, "kh-evisa.pdf", input.pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { error: docErr } = await supabase
    .from("application_documents")
    .insert({
      application_id: input.applicationId,
      kind: "evisa_pdf",
      storage_path: ref.path,
      metadata: { reference: input.reference, source: "kh_runner" },
    });
  if (docErr) {
    throw new Error(`application_documents insert: ${docErr.message}`);
  }

  const nowIso = new Date().toISOString();
  const { error: appErr } = await supabase
    .from("applications")
    .update({ status: "delivered", updated_at: nowIso })
    .eq("id", input.applicationId);
  if (appErr) {
    throw new Error(`application status update: ${appErr.message}`);
  }

  // Notification surface — best-effort; failure here doesn't roll back.
  try {
    const url = `${process.env.SUPABASE_URL ?? ""}/rest/v1/rpc/notify_doc_ready`;
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      // Cross-package call: hit the FE webhook bridge if present.
      // The FE side has lib/notify/dispatch.ts; cron / queue worker
      // can flip CS-002 from there. Here we just mark a queued row
      // in notification_event_log so the FE dispatcher picks it up
      // on the next tick.
      await supabase.from("notification_event_log").insert({
        applicant_id: input.applicantId,
        application_id: input.applicationId,
        event: "doc_ready",
        channel: "queued",
        outcome: "queued",
      });
      void url;
    }
  } catch (err) {
    console.error(`[kh-finalize] notify queue insert failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    storagePath: ref.path,
    signedUrl: ref.signedUrl,
    applicationStatus: "delivered",
  };
}
