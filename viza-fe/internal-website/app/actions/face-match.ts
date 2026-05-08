"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { compareFaces, decideFromScore, DEFAULT_FACE_MATCH_THRESHOLD } from "@/lib/face/match";

const STORAGE_BUCKET = "application-documents";

export interface FaceMatchActionResult {
  ok: boolean;
  score?: number;
  decision?: ReturnType<typeof decideFromScore>;
  reason?: string;
}

async function downloadDoc(applicationId: string, docType: string) {
  const adminClient = createAdminClient();
  const { data: doc } = await adminClient
    .from("application_documents")
    .select("storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", docType)
    .maybeSingle();
  if (!doc?.storage_path) return { error: `No ${docType} uploaded` };
  const { data: blob, error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(doc.storage_path);
  if (error || !blob) return { error: error?.message || "download failed" };
  return { storagePath: doc.storage_path, buffer: Buffer.from(await blob.arrayBuffer()) };
}

export async function runFaceMatch(applicationId: string): Promise<FaceMatchActionResult> {
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

  const passport = await downloadDoc(applicationId, "passport_scan");
  if ("error" in passport) return { ok: false, reason: passport.error };
  const applicantPhoto = await downloadDoc(applicationId, "applicant_photo");
  if ("error" in applicantPhoto) return { ok: false, reason: applicantPhoto.error };

  const result = await compareFaces(passport.buffer, applicantPhoto.buffer);
  const threshold = Number(process.env.FACE_MATCH_THRESHOLD || DEFAULT_FACE_MATCH_THRESHOLD);
  const decision = decideFromScore(result.score, threshold);

  await adminClient.from("face_match_audit").insert({
    applicant_id: app.applicant_id,
    application_id: app.id,
    provider: result.provider,
    score: result.score.toFixed(4),
    threshold: threshold.toFixed(4),
    decision,
    passport_storage_path: passport.storagePath,
    applicant_storage_path: applicantPhoto.storagePath,
  });

  if (decision === "staff_review" || decision === "reject") {
    await adminClient
      .from("applications")
      .update({ status: "staff_action_required", updated_at: new Date().toISOString() })
      .eq("id", app.id);
  }

  return { ok: true, score: result.score, decision };
}
