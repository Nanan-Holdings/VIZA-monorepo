import { createDecipheriv, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  applicant_id: string;
};

type FvAccountRow = {
  id: string;
  application_id?: string | null;
  submission_queue_id?: string | null;
  applicant_id?: string | null;
  email?: string | null;
  password_encrypted?: string | null;
  official_account_email_encrypted?: string | null;
  official_account_password_encrypted?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const KEY_LEN = 32;

function isMissingFvAccountColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("column fv_accounts.") ||
    message.includes("could not find")
  );
}

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return NextResponse.json({ error: applicationError.message }, { status: 500 });
  }
  const application = applicationData as ApplicationRow | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.applicant_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: accountData, error: accountError } = await admin
    .from("fv_accounts")
    .select(
      "id, application_id, submission_queue_id, user_id, official_account_email_encrypted, official_account_password_encrypted, updated_at, created_at",
    )
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let account = accountData as FvAccountRow | null;
  if (accountError && isMissingFvAccountColumnError(accountError)) {
    const { data: legacyData, error: legacyError } = await admin
      .from("fv_accounts")
      .select("id, applicant_id, email, password_encrypted, updated_at, created_at")
      .eq("applicant_id", application.applicant_id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (legacyError) {
      return NextResponse.json({ error: legacyError.message }, { status: 500 });
    }
    account = legacyData as FvAccountRow | null;
  } else if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json(
      {
        ok: true,
        account: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const email =
    decryptOrPlaintext(account.official_account_email_encrypted) ??
    account.email ??
    null;
  const password =
    decryptOrPlaintext(account.official_account_password_encrypted) ??
    decryptOrPlaintext(account.password_encrypted);

  return NextResponse.json(
    {
      ok: true,
      account: {
        email,
        password,
        portalUrl: "https://application-form.france-visas.gouv.fr/fv-fo-dde/",
        updatedAt: account.updated_at ?? account.created_at ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
