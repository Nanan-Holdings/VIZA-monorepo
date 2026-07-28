import { createDecipheriv, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicationApiApplicantProfileId } from "@/lib/application-api-auth";
import type { UkSubmissionResult } from "@/lib/submission-result";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  applicant_id: string;
  submission_result: UkSubmissionResult | null;
};

type UkAccountRow = {
  email: string | null;
  password_encrypted: string | null;
  resume_url: string | null;
};

const KEY_LEN = 32;

function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed cipher payload");
  }
  const [saltHex, ivHex, ctHex, tagHex] = parts;
  const passphrase = process.env.SUBMISSION_RESULT_SECRET_KEY;
  if (!passphrase || passphrase.length < 16) {
    throw new Error("SUBMISSION_RESULT_SECRET_KEY is not configured");
  }
  const key = scryptSync(passphrase, Buffer.from(saltHex, "hex"), KEY_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function decryptOrPlaintext(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return value;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const profileId = await getApplicationApiApplicantProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, submission_result")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = application.submission_result;
  let password =
    decryptOrPlaintext(result?.generatedPasswordCipher) ?? null;

  if (!password) {
    const { data: accountData, error: accountError } = await admin
      .from("uk_accounts")
      .select("email, password_encrypted, resume_url")
      .eq("applicant_id", application.applicant_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }
    const account = accountData as UkAccountRow | null;
    password = decryptOrPlaintext(account?.password_encrypted);
  }

  if (!password) {
    return NextResponse.json({ error: "UK portal password not available yet" }, { status: 404 });
  }

  return NextResponse.json(
    { password },
    { headers: { "Cache-Control": "no-store" } },
  );
}
