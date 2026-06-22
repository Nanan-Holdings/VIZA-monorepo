import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VN_OFFICIAL_FEE_AMOUNT = 25;
const VN_OFFICIAL_FEE_CURRENCY = "USD";
const VN_OFFICIAL_FEE_SOURCE_URL = "https://evisa.gov.vn/";

type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  status: string | null;
  government_fee_cents?: number | null;
  government_fee_currency?: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isVietnamEVisa(application: ApplicationRow): boolean {
  const country = normalize(application.country);
  const visaType = normalize(application.visa_type);
  return (
    ["VN", "VIETNAM", "VIET_NAM"].includes(country) &&
    ["VN_E_VISA", "VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(visaType)
  );
}

async function loadOwnedApplication(applicationId: string): Promise<
  | { userId: string; profile: ProfileRow; application: ApplicationRow; error: null }
  | { userId: null; profile: null; application: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: "Applicant profile not found" }, { status: 404 }) };
  }

  const { data, error } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, status, government_fee_cents, government_fee_currency")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  const application = data as ApplicationRow | null;
  if (!application) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!isVietnamEVisa(application)) {
    return { userId: null, profile: null, application: null, error: NextResponse.json({ error: "Official-fee automation is only enabled for Vietnam e-Visa." }, { status: 422 }) };
  }

  return { userId: user.id, profile, application, error: null };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const owned = await loadOwnedApplication(applicationId);
  if (owned.error) return owned.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.accepted !== true) {
    return NextResponse.json({ error: "Official-fee authorization must be accepted." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();
  const amount = owned.application.government_fee_cents
    ? owned.application.government_fee_cents / 100
    : VN_OFFICIAL_FEE_AMOUNT;
  const currency = owned.application.government_fee_currency ?? VN_OFFICIAL_FEE_CURRENCY;

  const { data: existingQuote } = await admin
    .from("official_fee_quotes")
    .select("*")
    .eq("application_id", applicationId)
    .neq("quote_status", "expired")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const quote = existingQuote
    ? existingQuote
    : (
        await admin
          .from("official_fee_quotes")
          .insert({
            application_id: applicationId,
            user_id: owned.userId,
            country_code: "VN",
            visa_type: owned.application.visa_type,
            official_fee_amount: amount,
            official_fee_currency: currency,
            total_charge_amount: amount,
            total_charge_currency: currency,
            fee_source: "vietnam_evisa_official_payment_page",
            fee_source_url: VN_OFFICIAL_FEE_SOURCE_URL,
            fee_breakdown_json: {
              source: "vietnam_evisa_official_payment_page",
              amount,
              currency,
              authorized_to_pay_on_behalf: true,
            },
            quote_status: "created",
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single()
      ).data;

  if (!quote) {
    return NextResponse.json({ error: "Could not create official fee quote." }, { status: 500 });
  }

  const quoteId = String((quote as { id: unknown }).id);
  const consentScope = {
    official_fee: {
      quote_id: quoteId,
      official_fee_amount: amount,
      official_fee_currency: currency,
      authorized_to_pay_on_behalf: true,
      consent_snapshot: {
        ui_language: "zh",
        accepted_text: "我授权 VIZA 使用受控支付工具代我向越南 e-Visa 官网支付本次官方签证费。",
      },
      accepted_at: now,
    },
  };

  const { error: consentError } = await admin.from("consent_events").upsert(
    {
      application_id: applicationId,
      applicant_id: owned.profile.id,
      auth_user_id: owned.userId,
      consent_type: "official_fee_payment_authorization",
      version: "2026-06-official-fee-v1",
      accepted: true,
      consent_scope: consentScope,
      source: "client_confirmation_tab",
      idempotency_key: `official-fee-consent:${applicationId}:${quoteId}:${owned.userId}`,
      created_at: now,
    },
    { onConflict: "idempotency_key" },
  );
  if (consentError) {
    return NextResponse.json({ error: consentError.message }, { status: 500 });
  }

  const { data: existingIntent } = await admin
    .from("official_fee_payment_intents")
    .select("*")
    .eq("application_id", applicationId)
    .eq("fee_quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const idempotencyKey = `official-fee:${applicationId}:${quoteId}:manual:company_advance`;
  const intent = existingIntent
    ? existingIntent
    : (
        await admin
          .from("official_fee_payment_intents")
          .insert({
            application_id: applicationId,
            user_id: owned.userId,
            fee_quote_id: quoteId,
            country_code: "VN",
            provider: "vietnam_evisa_official_fee",
            mode: process.env.VN_OFFICIAL_PAYMENT_AUTOPAY === "true" ? "live" : "manual",
            official_fee_amount: amount,
            official_fee_currency: currency,
            target_payee: "Vietnam e-Visa official portal",
            target_site: VN_OFFICIAL_FEE_SOURCE_URL,
            payment_method_type: "company_controlled",
            status: "admin_approved",
            idempotency_key: idempotencyKey,
            requires_admin_approval: false,
            admin_approved_at: now,
            user_consented_at: now,
            user_consent_snapshot_json: consentScope.official_fee,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single()
      ).data;

  if (!intent) {
    return NextResponse.json({ error: "Could not create official fee payment intent." }, { status: 500 });
  }

  await Promise.all([
    admin
      .from("official_fee_quotes")
      .update({ quote_status: "consented", updated_at: now })
      .eq("id", quoteId),
    admin
      .from("applications")
      .update({
        official_fee_status: "company_advance_approved",
        official_fee_quote_id: quoteId,
        official_fee_payment_intent_id: (intent as { id: string }).id,
        updated_at: now,
      })
      .eq("id", applicationId),
    admin.from("application_events").upsert(
      {
        application_id: applicationId,
        applicant_id: owned.profile.id,
        auth_user_id: owned.userId,
        event_type: "official_fee_authorized",
        actor_type: "user",
        actor_id: owned.userId,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-authorized:${applicationId}:${quoteId}`,
        message: "User authorized VIZA to pay the Vietnam e-Visa official fee.",
        metadata: { quote_id: quoteId, intent_id: (intent as { id: string }).id, amount, currency },
        occurred_at: now,
        created_at: now,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    ),
  ]);

  return NextResponse.json({
    ok: true,
    quote,
    intent: {
      ...(intent as Record<string, unknown>),
      payment_instrument_id: null,
      user_consent_snapshot_json: null,
    },
  });
}
