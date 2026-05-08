"use server";

import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";

/**
 * E-signature capture + audit log (DOC-005).
 *
 * Captures a hand-drawn signature PNG and a SHA-256 of the document
 * body the applicant saw at the moment of signing. The audit row
 * lands in `signature_event`; the PNG / signed PDF lands in the
 * `submission-artifacts` bucket.
 *
 * Pairs with the existing `/client/signing/[applicationId]` flow
 * (AU subclass-600). For other agency forms (authorisation, POA),
 * call this action with the kind set accordingly.
 */

const BUCKET = "submission-artifacts";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 200 * 1024;

export type SignatureDocKind =
  | "agency_authorisation"
  | "poa"
  | "au_subclass_600_signature"
  | "consulate_attestation";

export interface CaptureSignatureInput {
  applicationId: string;
  docKind: SignatureDocKind;
  /** Rendered doc body the applicant saw (markdown / text / json blob). */
  docBody: string;
  /** Hand-drawn signature PNG, base64-encoded. */
  signaturePngBase64: string;
}

export interface CaptureSignatureResult {
  ok: true;
  signatureId: string;
  docHash: string;
  storagePath: string;
}

async function readForensics() {
  const h = await headers();
  return {
    ip:
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
    ua: h.get("user-agent") ?? null,
  };
}

export async function captureSignature(
  input: CaptureSignatureInput,
): Promise<
  CaptureSignatureResult | { ok: false; reason: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Not authenticated" };

  const png = Buffer.from(input.signaturePngBase64, "base64");
  if (png.length === 0 || png.length > MAX_BYTES) {
    return {
      ok: false,
      reason:
        png.length === 0
          ? "Empty signature."
          : `Signature exceeds ${(MAX_BYTES / 1024).toFixed(0)} KB.`,
    };
  }
  if (!png.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, reason: "Signature must be a PNG." };
  }

  const docHash = createHash("sha256").update(input.docBody).digest("hex");
  const { ip, ua } = await readForensics();

  return withAdmin("system", "actions/signatures:capture", async (admin) => {
    const { data: app } = await admin
      .from("applications")
      .select("id, applicant_id")
      .eq("id", input.applicationId)
      .maybeSingle();
    if (!app) return { ok: false as const, reason: "Application not found" };
    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("auth_user_id")
      .eq("id", app.applicant_id)
      .maybeSingle();
    if (!profile || profile.auth_user_id !== user.id) {
      return { ok: false as const, reason: "Unauthorized" };
    }

    const path = `signatures/${app.applicant_id}/${app.id}/${input.docKind}-${Date.now()}.png`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, png, { contentType: "image/png", upsert: false });
    if (upErr) {
      return { ok: false as const, reason: `signature upload: ${upErr.message}` };
    }

    const { data: row, error: insErr } = await admin
      .from("signature_event")
      .insert({
        applicant_id: app.applicant_id,
        application_id: app.id,
        doc_kind: input.docKind,
        doc_hash: docHash,
        signed_storage_path: path,
        ip,
        ua,
      })
      .select("id")
      .single();
    if (insErr || !row) {
      return {
        ok: false as const,
        reason: `signature_event insert: ${insErr?.message}`,
      };
    }

    return {
      ok: true as const,
      signatureId: row.id as string,
      docHash,
      storagePath: path,
    };
  });
}

/** Read the audit history for an application (admin / staff portal). */
export async function listSignatureEvents(applicationId: string) {
  return withAdmin("admin", "actions/signatures:list", async (admin) => {
    const { data, error } = await admin
      .from("signature_event")
      .select("id, doc_kind, doc_hash, signed_storage_path, ip, ua, ts")
      .eq("application_id", applicationId)
      .order("ts", { ascending: false });
    if (error) throw new Error(`signature_event list: ${error.message}`);
    return data ?? [];
  });
}
