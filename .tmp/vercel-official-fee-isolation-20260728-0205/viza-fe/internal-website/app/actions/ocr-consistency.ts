"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { extractPassport, type OcrPayload, type ExtractedPassport, type ExtractedField } from "@/lib/passport/extract";

type PassportFieldKey = "surname" | "givenNames" | "dateOfBirth" | "passportNumber" | "expiryDate";

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "";

export interface ConsistencyEntry {
  typed: string | null;
  ocr: string | null;
  match: boolean;
  source: "mrz" | "ocr" | "missing";
}

export interface ConsistencyResult {
  applicationId: string;
  checkedAt: string;
  fields: Record<string, ConsistencyEntry>;
  overallMatch: boolean;
}

const FIELD_BINDINGS: Array<{ typedKey: string; ocrKey: PassportFieldKey }> = [
  { typedKey: "surname", ocrKey: "surname" },
  { typedKey: "given_names", ocrKey: "givenNames" },
  { typedKey: "date_of_birth", ocrKey: "dateOfBirth" },
  { typedKey: "passport_number", ocrKey: "passportNumber" },
  { typedKey: "passport_expiry_date", ocrKey: "expiryDate" },
];

function normalizeForCompare(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function isMatch(typed: string | null, ocr: string | null): boolean {
  if (!typed || !ocr) return false;
  return normalizeForCompare(typed) === normalizeForCompare(ocr);
}

export async function runOcrConsistencyCheck(
  applicationId: string,
): Promise<{ result?: ConsistencyResult; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();
  const { data: app } = await adminClient
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "Application not found" };

  const { data: profile } = await adminClient
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || profile.id !== app.applicant_id) {
    return { error: "Unauthorized" };
  }

  const { data: doc } = await adminClient
    .from("application_documents")
    .select("storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", "passport_scan")
    .maybeSingle();
  if (!doc?.storage_path) return { error: "No passport scan uploaded yet" };

  if (!AGENT_BACKEND_URL) {
    return { error: "AGENT_BACKEND_URL not configured" };
  }
  const { data: signed } = await adminClient.storage
    .from("application-documents")
    .createSignedUrl(doc.storage_path, 60);
  if (!signed?.signedUrl) {
    return { error: "Failed to sign passport scan URL" };
  }

  const upstream = await fetch(`${AGENT_BACKEND_URL}/api/passport-scan/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: signed.signedUrl }),
  });
  if (!upstream.ok) {
    return { error: `Upstream OCR failed: ${upstream.status}` };
  }
  const payload = (await upstream.json()) as OcrPayload;
  const extracted = extractPassport(payload);

  const { data: answerRows } = await adminClient
    .from("visa_application_answers")
    .select("field_name, value_text")
    .eq("application_id", applicationId);
  const typedMap: Record<string, string> = {};
  for (const row of answerRows ?? []) {
    if (row.value_text) typedMap[row.field_name as string] = row.value_text as string;
  }

  const fields: Record<string, ConsistencyEntry> = {};
  for (const binding of FIELD_BINDINGS) {
    const typed = typedMap[binding.typedKey] ?? null;
    const ocrField: ExtractedField | null = extracted[binding.ocrKey];
    const ocr = ocrField?.value ?? null;
    fields[binding.typedKey] = {
      typed,
      ocr,
      match: isMatch(typed, ocr),
      source: ocrField?.source ?? "missing",
    };
  }

  const result: ConsistencyResult = {
    applicationId,
    checkedAt: new Date().toISOString(),
    fields,
    overallMatch: Object.values(fields).every((f) => f.match),
  };

  await adminClient
    .from("application_documents")
    .update({
      metadata: { ocr_consistency: result },
      updated_at: new Date().toISOString(),
    })
    .eq("application_id", applicationId)
    .eq("document_type", "passport_scan");

  return { result };
}
