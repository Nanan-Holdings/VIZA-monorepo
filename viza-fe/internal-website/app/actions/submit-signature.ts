"use server";

import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist the applicant's signature PNG and queue the AU runner to push past
 * Review. The signature lives in the `submission-artifacts` bucket at the
 * deterministic path `au-signatures/<applicationId>.png` — no new column on
 * `applications` is needed; the back-end derives the same path from the
 * application_id when it picks the job up.
 *
 * Side effect: flips `submission_queue.status` to `au_prefill_pending` so
 * the polling loop in viza-be/submission-service picks the application up
 * for sign-and-submit.
 */

const BUCKET = "submission-artifacts";
const PROFILE_DOCUMENTS_BUCKET = "application-documents";
const MAX_BYTES = 200 * 1024; // 200 KB — a 600×200 transparent PNG is ~30 KB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REUSABLE_SIGNATURE_TYPES = ["electronic_signature", "customs_signature_file", "signature", "signature_image"];

// Internal helper — must stay unexported: a "use server" module may only
// export async functions.
function signaturePathForApplication(applicationId: string): string {
  return `au-signatures/${applicationId}.png`;
}

function isPng(buffer: Buffer): boolean {
  if (buffer.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (buffer[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

export async function submitSignature(
  applicationId: string,
  pngBytes: ArrayBuffer | Uint8Array,
): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const buffer = pngBytes instanceof Uint8Array ? Buffer.from(pngBytes) : Buffer.from(new Uint8Array(pngBytes));
  if (buffer.length === 0) return { ok: false, error: "Empty signature" };
  if (buffer.length > MAX_BYTES) return { ok: false, error: "Signature exceeds 200 KB" };
  if (!isPng(buffer)) return { ok: false, error: "Signature must be a PNG" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const adminClient = createAdminClient();

  // Verify the application belongs to the caller and is AU.
  const { data: app, error: appErr } = await adminClient
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) return { ok: false, error: "Application not found" };
  if (app.country !== "australia" && app.visa_type !== "AU_VISITOR_600") {
    return { ok: false, error: "Signing is only available for AU Subclass 600 applications" };
  }

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile || profile.id !== app.applicant_id) {
    return { ok: false, error: "Unauthorized" };
  }

  const storagePath = signaturePathForApplication(applicationId);

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadErr) return { ok: false, error: `Upload failed: ${uploadErr.message}` };

  // Keep a reusable copy for other application forms and fail visibly if the
  // private profile copy cannot be persisted.
  const reusablePath = `${user.id}/universal-profile/electronic_signature/${Date.now()}-signature.png`;
  const { error: reusableUploadError } = await adminClient.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .upload(reusablePath, buffer, { contentType: "image/png", upsert: false });
  if (reusableUploadError) {
    await adminClient.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: `Could not save reusable signature: ${reusableUploadError.message}` };
  }
  const { error: reusableRecordError } = await adminClient.from("universal_profile_documents").upsert(
    {
      applicant_id: profile.id,
      auth_user_id: user.id,
      document_type: "electronic_signature",
      storage_path: reusablePath,
      filename: "signature.png",
      status: "uploaded",
      source_application_id: applicationId,
      metadata: { source: "au_signature_pad" },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "applicant_id,document_type" },
  );
  if (reusableRecordError) {
    await Promise.all([
      adminClient.storage.from(BUCKET).remove([storagePath]),
      adminClient.storage.from(PROFILE_DOCUMENTS_BUCKET).remove([reusablePath]),
    ]);
    return { ok: false, error: `Could not save reusable signature: ${reusableRecordError.message}` };
  }

  // Flip submission_queue to au_prefill_pending so the runner picks it up.
  // upsert covers the first-time case; onConflict on application_id keeps it idempotent.
  const { error: queueErr } = await adminClient
    .from("submission_queue")
    .upsert(
      {
        application_id: applicationId,
        status: "au_prefill_pending",
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "application_id" },
    );
  if (queueErr) return { ok: false, error: `Queue update failed: ${queueErr.message}` };

  return { ok: true, storagePath };
}

export interface SigningContext {
  applicationId: string;
  country: string;
  visaType: string;
  isAuVisitor600: boolean;
  alreadySigned: boolean;
  hasReusableSignature: boolean;
  /** Map of declaration field_name → recorded value ("yes"/"no"/"") */
  declarationAnswers: Record<string, string>;
}

/**
 * Server-side fetch used by the /client/signing/[applicationId] page to
 * decide whether to render the signature pad, show an already-signed banner,
 * or 404 (non-AU). Bundles the read-only helpers into one round-trip.
 */
export async function getSigningContext(
  applicationId: string,
): Promise<{ ok: true; context: SigningContext } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app, error: appErr } = await adminClient
    .from("applications")
    .select("id, applicant_id, country, visa_type")
    .eq("id", applicationId)
    .single();
  if (appErr || !app) return { ok: false, error: "Application not found" };

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile || profile.id !== app.applicant_id) {
    return { ok: false, error: "Unauthorized" };
  }

  const isAuVisitor600 = app.country === "australia" || app.visa_type === "AU_VISITOR_600";

  const { data: answers } = await adminClient
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId)
    .like("field_name", "decl_%");

  const declarationAnswers: Record<string, string> = {};
  for (const row of answers ?? []) {
    if (row.field_name && typeof row.value_text === "string") {
      declarationAnswers[row.field_name] = row.value_text;
    }
  }

  const alreadySigned = await hasExistingSignature(applicationId);
  const { data: reusableSignatures } = await adminClient
    .from("universal_profile_documents")
    .select("id, filename")
    .eq("applicant_id", profile.id)
    .in("document_type", REUSABLE_SIGNATURE_TYPES)
    .neq("status", "missing")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(10);

  return {
    ok: true,
    context: {
      applicationId,
      country: app.country,
      visaType: app.visa_type,
      isAuVisitor600,
      alreadySigned,
      hasReusableSignature: Boolean(reusableSignatures?.some((row) => isReusableSignatureFilename(row.filename))),
      declarationAnswers,
    },
  };
}

function isReusableSignatureFilename(filename: string | null): boolean {
  return Boolean(filename && /\.(?:png|jpe?g)$/i.test(filename));
}

export async function submitSavedUniversalProfileSignature(
  applicationId: string,
): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!profile) return { ok: false, error: "Applicant profile not found" };

  const { data: reusableSignatures, error } = await adminClient
    .from("universal_profile_documents")
    .select("storage_path, filename")
    .eq("applicant_id", profile.id)
    .in("document_type", REUSABLE_SIGNATURE_TYPES)
    .neq("status", "missing")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(10);
  const reusableSignature = reusableSignatures?.find((row) => isReusableSignatureFilename(row.filename));
  if (error || !reusableSignature?.storage_path) {
    return { ok: false, error: "No reusable signature is available" };
  }

  const { data: signatureBlob, error: downloadError } = await adminClient.storage
    .from(PROFILE_DOCUMENTS_BUCKET)
    .download(reusableSignature.storage_path);
  if (downloadError || !signatureBlob) {
    return { ok: false, error: `Could not read saved signature: ${downloadError?.message ?? "missing file"}` };
  }

  const savedBuffer = Buffer.from(await signatureBlob.arrayBuffer());
  let pngBuffer: Buffer;
  try {
    pngBuffer = isPng(savedBuffer)
      ? savedBuffer
      : await sharp(savedBuffer)
          .resize({ width: 600, height: 200, fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
  } catch {
    return { ok: false, error: "Saved signature is not a valid PNG or JPEG image" };
  }

  return submitSignature(applicationId, new Uint8Array(pngBuffer));
}

/**
 * Read-only helper used by the signing page to short-circuit when a signature
 * has already been uploaded for this application. Returns true if the file
 * exists in `submission-artifacts/au-signatures/<applicationId>.png`.
 */
export async function hasExistingSignature(applicationId: string): Promise<boolean> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .list("au-signatures", { search: `${applicationId}.png`, limit: 1 });
  if (error) return false;
  return Boolean(data?.some((f) => f.name === `${applicationId}.png`));
}
