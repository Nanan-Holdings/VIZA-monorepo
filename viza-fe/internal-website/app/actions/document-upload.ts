"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_KINDS = new Set(["passport_scan", "applicant_photo"]);

export interface DocumentValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Server-side enforcement of file constraints (DOCUP-001).
 *
 * Called after the client-side upload to verify that what actually landed
 * in object storage matches the constraints we enforce in
 * `<DocumentUpload>` — defense-in-depth against a tampered client.
 * On failure marks `application_documents.status='rejected'` so the UI
 * can prompt for re-upload.
 */
export async function verifyUploadedDocument(args: {
  applicationId: string;
  kind: string;
  storagePath: string;
}): Promise<DocumentValidationResult> {
  const { applicationId, kind, storagePath } = args;
  if (!ALLOWED_KINDS.has(kind)) {
    return { ok: false, reason: `Unsupported document kind '${kind}'.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false, reason: "Application not found" };

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.id !== app.applicant_id) {
    return { ok: false, reason: "Unauthorized" };
  }

  const folder = storagePath.split("/").slice(0, -1).join("/");
  const filename = storagePath.split("/").pop() ?? "";
  const { data: list, error: listError } = await adminClient.storage
    .from("application-documents")
    .list(folder, { limit: 100 });
  if (listError) return { ok: false, reason: listError.message };
  const match = list?.find((f) => f.name === filename);
  if (!match) return { ok: false, reason: "Uploaded object not found in storage" };

  const size = (match.metadata as { size?: number } | null)?.size ?? 0;
  const contentType = (match.metadata as { mimetype?: string } | null)?.mimetype ?? "";
  if (size > MAX_BYTES) {
    await markRejected(adminClient, applicationId, kind, `File ${size} bytes > ${MAX_BYTES} max.`);
    return { ok: false, reason: `File ${(size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit.` };
  }
  if (contentType && !ALLOWED_MIME.has(contentType)) {
    await markRejected(adminClient, applicationId, kind, `Disallowed mime '${contentType}'`);
    return { ok: false, reason: `Disallowed mime type '${contentType}'.` };
  }

  await adminClient
    .from("application_documents")
    .update({ status: "uploaded", rejection_reason: null, updated_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("document_type", kind);

  return { ok: true };
}

async function markRejected(
  adminClient: ReturnType<typeof createAdminClient>,
  applicationId: string,
  kind: string,
  reason: string,
): Promise<void> {
  await adminClient
    .from("application_documents")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("application_id", applicationId)
    .eq("document_type", kind);
}
