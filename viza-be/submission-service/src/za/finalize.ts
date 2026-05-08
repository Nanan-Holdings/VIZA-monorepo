import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";

/**
 * South Africa post-payment finalisation (AUTO-ZA-03). Mirrors KH/LA/LK.
 */

export interface PersistZaDeliveredInput {
  applicationId: string;
  applicantId: string;
  jobId: string;
  reference: string | null;
  pdfBytes: Buffer | Uint8Array;
}

export interface PersistZaDeliveredResult {
  storagePath: string;
  signedUrl: string;
  applicationStatus: "delivered";
}

export async function persistZaDelivered(
  input: PersistZaDeliveredInput,
): Promise<PersistZaDeliveredResult> {
  const ref = await artifact.put(input.jobId, "za-evisa.pdf", input.pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { error: docErr } = await supabase.from("application_documents").insert({
    application_id: input.applicationId,
    kind: "evisa_pdf",
    storage_path: ref.path,
    metadata: { reference: input.reference, source: "za_runner" },
  });
  if (docErr) throw new Error(`application_documents insert: ${docErr.message}`);

  const { error: appErr } = await supabase
    .from("applications")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", input.applicationId);
  if (appErr) throw new Error(`application status update: ${appErr.message}`);

  try {
    await supabase.from("notification_event_log").insert({
      applicant_id: input.applicantId,
      application_id: input.applicationId,
      event: "doc_ready",
      channel: "queued",
      outcome: "queued",
    });
  } catch (err) {
    console.error(`[za-finalize] notify queue insert failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    storagePath: ref.path,
    signedUrl: ref.signedUrl,
    applicationStatus: "delivered",
  };
}
