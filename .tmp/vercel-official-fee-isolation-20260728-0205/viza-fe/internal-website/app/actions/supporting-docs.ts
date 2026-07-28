"use server";

import { Buffer } from "node:buffer";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import { validateSupportingDoc } from "@/lib/docs/supporting";

/**
 * Supporting-document checklist + uploads (DOC-003).
 *
 * - getChecklist(applicationId) → slot rows + per-slot status (missing
 *   / uploaded / accepted / rejected).
 * - uploadSupportingDoc(applicationId, slotId, base64) — validates
 *   format/size, writes under `applications/<id>/<slot>` in the
 *   submission-artifacts bucket, upserts a supporting_doc_submission
 *   row.
 * - reviewSupportingDoc(submissionId, decision, comment?) — admin
 *   action to accept / reject with a comment.
 */

const BUCKET = "submission-artifacts";

export interface ChecklistRow {
  slotId: string;
  slotKey: string;
  label: string;
  required: boolean;
  description: string | null;
  acceptedMimeHint: string | null;
  maxBytes: number;
  position: number;
  status: "missing" | "uploaded" | "accepted" | "rejected";
  storagePath: string | null;
  staffComment: string | null;
}

interface SlotRow {
  id: string;
  slot_key: string;
  label: string;
  required: boolean;
  description: string | null;
  accepted_mime_hint: string | null;
  max_bytes: number;
  position: number;
}

interface SubmissionRow {
  slot_id: string;
  storage_path: string;
  status: ChecklistRow["status"];
  staff_comment: string | null;
}

async function loadApplicationForCaller(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return withAdmin("system", "actions/supporting-docs:load", async (admin) => {
    const { data: app } = await admin
      .from("applications")
      .select("id, applicant_id, country, visa_type")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) throw new Error("Application not found");
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("auth_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    if (!profile || profile.auth_user_id !== user.id) {
      throw new Error("Unauthorized");
    }
    return { user, app };
  });
}

export async function getChecklist(applicationId: string): Promise<ChecklistRow[]> {
  const { app } = await loadApplicationForCaller(applicationId);
  return withAdmin("system", "actions/supporting-docs:getChecklist", async (admin) => {
    const { data: pkg } = await admin
      .from("visa_packages")
      .select("id")
      .eq("country", app.country)
      .eq("visa_type", app.visa_type)
      .maybeSingle();
    if (!pkg) return [];
    const { data: slots } = await admin
      .from("supporting_doc_slot")
      .select(
        "id, slot_key, label, required, description, accepted_mime_hint, max_bytes, position",
      )
      .eq("package_id", pkg.id)
      .order("position", { ascending: true });
    const slotRows = (slots ?? []) as SlotRow[];

    const { data: subs } = await admin
      .from("supporting_doc_submission")
      .select("slot_id, storage_path, status, staff_comment")
      .eq("application_id", applicationId);
    const subById = new Map<string, SubmissionRow>();
    for (const s of (subs ?? []) as SubmissionRow[]) subById.set(s.slot_id, s);

    return slotRows.map((s): ChecklistRow => {
      const sub = subById.get(s.id);
      return {
        slotId: s.id,
        slotKey: s.slot_key,
        label: s.label,
        required: s.required,
        description: s.description,
        acceptedMimeHint: s.accepted_mime_hint,
        maxBytes: s.max_bytes,
        position: s.position,
        status: sub?.status ?? "missing",
        storagePath: sub?.storage_path ?? null,
        staffComment: sub?.staff_comment ?? null,
      };
    });
  });
}

export interface UploadInput {
  applicationId: string;
  slotId: string;
  base64: string;
  filename?: string;
}

export async function uploadSupportingDoc(input: UploadInput): Promise<{
  ok: true;
  storagePath: string;
  status: ChecklistRow["status"];
} | {
  ok: false;
  reason: string;
}> {
  const { app } = await loadApplicationForCaller(input.applicationId);
  return withAdmin("system", "actions/supporting-docs:upload", async (admin) => {
    const { data: slot } = await admin
      .from("supporting_doc_slot")
      .select("id, slot_key, max_bytes, package_id")
      .eq("id", input.slotId)
      .maybeSingle();
    if (!slot) return { ok: false as const, reason: "Slot not found" };
    void app;

    const buf = Buffer.from(input.base64, "base64");
    const verdict = validateSupportingDoc(buf, slot.max_bytes);
    if (!verdict.ok) {
      return { ok: false as const, reason: verdict.reason };
    }

    const ext =
      verdict.mime === "application/pdf"
        ? "pdf"
        : verdict.mime === "image/jpeg"
          ? "jpg"
          : "png";
    const path = `applications/${input.applicationId}/${slot.slot_key}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: verdict.mime,
        upsert: true,
      });
    if (upErr) {
      return { ok: false as const, reason: `upload failed: ${upErr.message}` };
    }

    const { error: dbErr } = await admin
      .from("supporting_doc_submission")
      .upsert(
        {
          application_id: input.applicationId,
          slot_id: slot.id,
          storage_path: path,
          mime: verdict.mime,
          size_bytes: verdict.sizeBytes,
          status: "uploaded",
          staff_comment: null,
          reviewed_by: null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id,slot_id" },
      );
    if (dbErr) {
      return { ok: false as const, reason: `record failed: ${dbErr.message}` };
    }
    return { ok: true as const, storagePath: path, status: "uploaded" };
  });
}

export interface ReviewInput {
  submissionId: string;
  decision: "accepted" | "rejected";
  comment?: string;
}

export async function reviewSupportingDoc(
  input: ReviewInput,
): Promise<{ ok: true; status: ChecklistRow["status"] } | { ok: false; reason: string }> {
  return withAdmin("admin", "actions/supporting-docs:review", async (admin) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false as const, reason: "Not authenticated" };
    const { error } = await admin
      .from("supporting_doc_submission")
      .update({
        status: input.decision,
        staff_comment: input.comment ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.submissionId);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, status: input.decision };
  });
}
