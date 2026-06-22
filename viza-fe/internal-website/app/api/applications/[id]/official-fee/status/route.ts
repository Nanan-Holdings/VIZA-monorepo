import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  official_fee_status?: string | null;
  official_fee_quote_id?: string | null;
  official_fee_payment_intent_id?: string | null;
  official_fee_receipt_id?: string | null;
};

type ProfileRow = {
  id: string;
};

type QueryErrorLike = {
  message?: string;
  code?: string;
};

function isSchemaMissing(error: QueryErrorLike | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

async function loadOwnedApplication(applicationId: string): Promise<
  | { application: ApplicationRow; error: null }
  | { application: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { application: null, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return { application: null, error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return { application: null, error: NextResponse.json({ error: "Applicant profile not found" }, { status: 404 }) };
  }

  const { data, error } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, official_fee_status, official_fee_quote_id, official_fee_payment_intent_id, official_fee_receipt_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    return { application: null, error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  const application = data as ApplicationRow | null;
  if (!application) {
    return { application: null, error: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { application: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { application, error: null };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const owned = await loadOwnedApplication(applicationId);
  if (owned.error) return owned.error;

  const admin = createAdminClient();
  const [quoteResult, intentResult] = await Promise.all([
    admin
      .from("official_fee_quotes")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("official_fee_payment_intents")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (quoteResult.error && !isSchemaMissing(quoteResult.error)) {
    return NextResponse.json({ error: quoteResult.error.message }, { status: 500 });
  }
  if (intentResult.error && !isSchemaMissing(intentResult.error)) {
    return NextResponse.json({ error: intentResult.error.message }, { status: 500 });
  }

  const intent = intentResult.data as { id?: string } | null;
  const [attemptsResult, receiptResult] = intent?.id
    ? await Promise.all([
        admin
          .from("official_fee_payment_attempts")
          .select("*")
          .eq("official_fee_payment_intent_id", intent.id)
          .order("attempt_number", { ascending: true }),
        admin
          .from("official_fee_receipts")
          .select("*")
          .eq("official_fee_payment_intent_id", intent.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: [], error: null }, { data: null, error: null }];

  if (attemptsResult.error && !isSchemaMissing(attemptsResult.error)) {
    return NextResponse.json({ error: attemptsResult.error.message }, { status: 500 });
  }
  if (receiptResult.error && !isSchemaMissing(receiptResult.error)) {
    return NextResponse.json({ error: receiptResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      application: owned.application,
      quote: quoteResult.data ?? null,
      intent: intentResult.data
        ? {
            ...(intentResult.data as Record<string, unknown>),
            payment_instrument_id: null,
            user_consent_snapshot_json: null,
          }
        : null,
      attempts: attemptsResult.data ?? [],
      receipt: receiptResult.data ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
