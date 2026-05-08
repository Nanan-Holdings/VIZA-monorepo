import { supabase } from "../supabase.js";
import { artifact } from "../artifact.js";
import { inbox, type InboundMessage } from "../inbox/wait-for-message.js";
import { extractAuto } from "../inbox/extractors/index.js";

/**
 * Vietnam e-Visa post-payment finalisation (AUTO-VN-03).
 *
 * VN flow:
 *   1. Runner (run.ts) prefills + halts at the registration code.
 *   2. Applicant pays manually on evisa.gov.vn (PAY-003 = applicant_direct_link).
 *   3. ~3 working days later, evisa@xuatnhapcanh.gov.vn emails the e-Visa PDF.
 *
 * `waitForVietnamEvisa` polls the inbox until that email arrives,
 * downloads the attached PDF, and persists it via persistVnDelivered.
 */

export interface PersistVnDeliveredInput {
  applicationId: string;
  applicantId: string;
  jobId: string;
  reference: string | null;
  pdfBytes: Buffer | Uint8Array;
}

export interface PersistVnDeliveredResult {
  storagePath: string;
  signedUrl: string;
  applicationStatus: "delivered";
}

/**
 * Wait for an evisa.gov.vn delivery email. Attachment extraction
 * happens downstream — InboundMessage carries the message body +
 * `r2_key` pointer for the raw RFC822 payload, which a separate
 * attachment-extractor processes to pull out the PDF.
 */
export async function waitForVietnamEvisa(
  applicantId: string,
  timeoutMs: number = 5 * 24 * 60 * 60 * 1000,
): Promise<{ message: InboundMessage; reference: string | null }> {
  const message = await inbox.waitForMessage(
    applicantId,
    (m) => /evisa|xuatnhapcanh\.gov\.vn|immigration\.gov\.vn/i.test(m.from_addr),
    timeoutMs,
  );
  const parsed = extractAuto({
    from: message.from_addr,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { message, reference: parsed.reference ?? null };
}

export async function persistVnDelivered(
  input: PersistVnDeliveredInput,
): Promise<PersistVnDeliveredResult> {
  const ref = await artifact.put(input.jobId, "vn-evisa.pdf", input.pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { error: docErr } = await supabase.from("application_documents").insert({
    application_id: input.applicationId,
    kind: "evisa_pdf",
    storage_path: ref.path,
    metadata: { reference: input.reference, source: "vn_runner" },
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
    console.error(`[vn-finalize] notify queue insert failed: ${err instanceof Error ? err.message : err}`);
  }

  return {
    storagePath: ref.path,
    signedUrl: ref.signedUrl,
    applicationStatus: "delivered",
  };
}
