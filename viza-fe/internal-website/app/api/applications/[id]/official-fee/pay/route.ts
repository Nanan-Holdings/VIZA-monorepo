import { NextResponse } from "next/server";
import {
  isIndonesiaEVisaApplication,
  queueProviderForApplication,
  queueStatusForApplication,
} from "@/lib/submission-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VN_OFFICIAL_FEE_AMOUNT = 25;
const VN_OFFICIAL_FEE_CURRENCY = "USD";
const VN_OFFICIAL_FEE_SOURCE_URL = "https://evisa.gov.vn/";

type ProfileRow = { id: string };
type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  submission_result?: unknown;
  government_fee_cents?: number | null;
  government_fee_currency?: string | null;
};

type QueryErrorLike = {
  message?: string;
  code?: string;
};

type OneTimeCardInput = {
  pan: string;
  expiry: string;
  cvv: string;
  holderName: string;
};

function isSchemaMissing(error: QueryErrorLike | null | undefined): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

function isDuplicateKey(error: QueryErrorLike | null | undefined): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "23505" || message.includes("duplicate key value");
}

async function recordFallbackOfficialFeeConsent(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const amount = input.application.government_fee_cents
    ? input.application.government_fee_cents / 100
    : VN_OFFICIAL_FEE_AMOUNT;
  const currency = input.application.government_fee_currency ?? VN_OFFICIAL_FEE_CURRENCY;
  const fallbackQuoteId = `fallback:${input.applicationId}`;
  const consentScope = {
    official_fee: {
      quote_id: fallbackQuoteId,
      official_fee_amount: amount,
      official_fee_currency: currency,
      authorized_to_pay_on_behalf: true,
      schema_fallback: true,
      consent_snapshot: {
        ui_language: "zh",
        accepted_text: "我授权 VIZA 使用本次一次性银行卡信息代我向越南 e-Visa 官网支付本次官方签证费。",
      },
      accepted_at: now,
    },
  };

  const [consentResult, eventResult] = await Promise.all([
    input.admin.from("consent_events").insert(
      {
        application_id: input.applicationId,
        applicant_id: input.profileId,
        auth_user_id: input.userId,
        consent_type: "official_fee_payment_authorization",
        version: "2026-06-official-fee-v1",
        accepted: true,
        consent_scope: consentScope,
        source: "client_confirmation_tab_payment",
        idempotency_key: `official-fee-consent-fallback:${input.applicationId}:${input.userId}`,
        created_at: now,
      },
    ),
    input.admin.from("application_events").insert(
      {
        application_id: input.applicationId,
        applicant_id: input.profileId,
        auth_user_id: input.userId,
        event_type: "official_fee_authorized",
        actor_type: "user",
        actor_id: input.userId,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-authorized-fallback:${input.applicationId}`,
        message: "User authorized VIZA to pay the Vietnam e-Visa official fee from the payment card form. Official-fee tables were missing; recorded fallback consent only.",
        metadata: { quote_id: fallbackQuoteId, amount, currency, schema_fallback: true },
        occurred_at: now,
        created_at: now,
      },
    ),
  ]);

  if (consentResult.error && !isSchemaMissing(consentResult.error) && !isDuplicateKey(consentResult.error)) {
    return { ok: false, error: consentResult.error.message };
  }
  if (eventResult.error && !isSchemaMissing(eventResult.error) && !isDuplicateKey(eventResult.error)) {
    return { ok: false, error: eventResult.error.message };
  }
  return { ok: true };
}

async function createOfficialFeeIntentFromPaymentRequest(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
}): Promise<
  | { ok: true; intentRow: { id: string; status?: string | null; schemaFallback?: boolean } }
  | { ok: false; error: string; status?: number }
> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const amount = input.application.government_fee_cents
    ? input.application.government_fee_cents / 100
    : VN_OFFICIAL_FEE_AMOUNT;
  const currency = input.application.government_fee_currency ?? VN_OFFICIAL_FEE_CURRENCY;

  const { data: existingQuote, error: existingQuoteError } = await input.admin
    .from("official_fee_quotes")
    .select("*")
    .eq("application_id", input.applicationId)
    .neq("quote_status", "expired")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingQuoteError) {
    return { ok: false, error: existingQuoteError.message, status: 500 };
  }

  const quote = existingQuote
    ? existingQuote
    : (
        await input.admin
          .from("official_fee_quotes")
          .insert({
            application_id: input.applicationId,
            user_id: input.userId,
            country_code: "VN",
            visa_type: input.application.visa_type,
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
    return { ok: false, error: "Could not create official fee quote.", status: 500 };
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
        accepted_text: "我授权 VIZA 使用本次一次性银行卡信息代我向越南 e-Visa 官网支付本次官方签证费。",
      },
      accepted_at: now,
    },
  };

  const { error: consentError } = await input.admin.from("consent_events").insert(
    {
      application_id: input.applicationId,
      applicant_id: input.profileId,
      auth_user_id: input.userId,
      consent_type: "official_fee_payment_authorization",
      version: "2026-06-official-fee-v1",
      accepted: true,
      consent_scope: consentScope,
      source: "client_confirmation_tab_payment",
      idempotency_key: `official-fee-consent:${input.applicationId}:${quoteId}:${input.userId}`,
      created_at: now,
    },
  );
  if (consentError && !isDuplicateKey(consentError)) {
    return { ok: false, error: consentError.message, status: 500 };
  }

  const { data: existingIntent, error: existingIntentError } = await input.admin
    .from("official_fee_payment_intents")
    .select("*")
    .eq("application_id", input.applicationId)
    .eq("fee_quote_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingIntentError) {
    return { ok: false, error: existingIntentError.message, status: 500 };
  }
  if (existingIntent) {
    return { ok: true, intentRow: existingIntent as { id: string; status?: string | null } };
  }

  const idempotencyKey = `official-fee:${input.applicationId}:${quoteId}:manual:company_advance`;
  const { data: insertedIntent, error: insertIntentError } = await input.admin
    .from("official_fee_payment_intents")
    .insert({
      application_id: input.applicationId,
      user_id: input.userId,
      fee_quote_id: quoteId,
      country_code: "VN",
      provider: "vietnam_evisa_official_fee",
      mode: process.env.VN_OFFICIAL_PAYMENT_AUTOPAY === "true" ? "live" : "manual",
      official_fee_amount: amount,
      official_fee_currency: currency,
      target_payee: "Vietnam e-Visa official portal",
      target_site: VN_OFFICIAL_FEE_SOURCE_URL,
      payment_method_type: "one_time_user_card",
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
    .single();
  if (insertIntentError && isDuplicateKey(insertIntentError)) {
    const { data: duplicateIntent, error: duplicateIntentError } = await input.admin
      .from("official_fee_payment_intents")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (duplicateIntentError || !duplicateIntent) {
      return {
        ok: false,
        error: duplicateIntentError?.message ?? "Could not load duplicate official fee payment intent.",
        status: 500,
      };
    }
    return { ok: true, intentRow: duplicateIntent as { id: string; status?: string | null } };
  }
  if (insertIntentError || !insertedIntent) {
    return { ok: false, error: insertIntentError?.message ?? "Could not create official fee payment intent.", status: 500 };
  }

  await Promise.all([
    input.admin
      .from("official_fee_quotes")
      .update({ quote_status: "consented", updated_at: now })
      .eq("id", quoteId),
    input.admin.from("application_events").insert(
      {
        application_id: input.applicationId,
        applicant_id: input.profileId,
        auth_user_id: input.userId,
        event_type: "official_fee_authorized",
        actor_type: "user",
        actor_id: input.userId,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-authorized:${input.applicationId}:${quoteId}`,
        message: "User authorized VIZA to pay the Vietnam e-Visa official fee from the payment card form.",
        metadata: { quote_id: quoteId, intent_id: (insertedIntent as { id: string }).id, amount, currency },
        occurred_at: now,
        created_at: now,
      },
    ),
  ]);

  return { ok: true, intentRow: insertedIntent as { id: string; status?: string | null } };
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isVietnamEVisa(application: ApplicationRow): boolean {
  return (
    ["VN", "VIETNAM", "VIET_NAM"].includes(normalize(application.country)) &&
    ["VN_E_VISA", "VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(normalize(application.visa_type))
  );
}

function readRegistrationCode(result: unknown): string | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const value = (result as { registrationCode?: unknown }).registrationCode;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCardBody(body: unknown): OneTimeCardInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const card = (body as { card?: unknown }).card;
  if (!card || typeof card !== "object" || Array.isArray(card)) return null;
  const value = card as Record<string, unknown>;
  const pan = typeof value.pan === "string" ? value.pan.trim() : "";
  const expiry = typeof value.expiry === "string" ? value.expiry.trim() : "";
  const cvv = typeof value.cvv === "string" ? value.cvv.trim() : "";
  const holderName = typeof value.holderName === "string" ? value.holderName.trim() : "";
  if (!pan || !expiry || !cvv) return null;
  return { pan, expiry, cvv, holderName };
}

function getSubmissionServiceLocalUrl(): string {
  const configured = process.env.SUBMISSION_SERVICE_LOCAL_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const port = process.env.SUBMISSION_SERVICE_HEALTH_PORT?.trim() || "18080";
  return `http://127.0.0.1:${port}`;
}

function getSubmissionServiceLocalUrlCandidates(countryPath: "vietnam" | "indonesia"): string[] {
  const configured = getSubmissionServiceLocalUrl();
  const indonesiaUrls = [
    configured,
    ...Array.from({ length: 41 }, (_, index) => `http://127.0.0.1:${18080 + index}`),
    "http://127.0.0.1:18080",
    "http://127.0.0.1:8080",
  ];
  const vietnamUrls = [
    configured,
    "http://127.0.0.1:18080",
    ...Array.from({ length: 41 }, (_, index) => `http://127.0.0.1:${18080 + index}`),
    "http://127.0.0.1:8080",
  ];
  const urls = (countryPath === "indonesia" ? indonesiaUrls : vietnamUrls)
    .map((value) => value.replace(/\/+$/, ""));
  return Array.from(new Set(urls));
}

function officialFeeCardSessionPath(application: ApplicationRow): "vietnam" | "indonesia" {
  return isIndonesiaEVisaApplication(application.country, application.visa_type) ? "indonesia" : "vietnam";
}

async function registerOneTimeCardSession(applicationId: string, application: ApplicationRow, card: OneTimeCardInput): Promise<
  | { ok: true; redactedCard: unknown; expiresAtIso: string | null }
  | { ok: false; error: string }
> {
  const countryPath = officialFeeCardSessionPath(application);
  const attempts: string[] = [];
  for (const baseUrl of getSubmissionServiceLocalUrlCandidates(countryPath)) {
    const endpoint = `${baseUrl}/local/${countryPath}/card-session`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          card: {
            pan: card.pan,
            expiry: card.expiry,
            cvv: card.cvv,
            holderName: card.holderName,
          },
        }),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok) {
        const reason =
          typeof payload?.error === "string"
            ? payload.error
            : `HTTP ${response.status}`;
        attempts.push(`${endpoint} -> ${response.status} ${reason}`);
        continue;
      }
      return {
        ok: true,
        redactedCard: payload?.redactedCard ?? null,
        expiresAtIso: typeof payload?.expiresAtIso === "string" ? payload.expiresAtIso : null,
      };
    } catch (error) {
      attempts.push(`${endpoint} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.error("Could not register one-time official-fee card session", {
    applicationId,
    countryPath,
    attempts,
  });
  return {
    ok: false,
    error:
      countryPath === "indonesia"
        ? "本机 Indonesia submission worker 没有运行，或未开启 Indonesia 一次性银行卡会话端点。请启动 scripts/start-indonesia-submission-worker.cmd 后重试。"
        : "本机 submission-service 没有运行，或未开启一次性银行卡会话端点。请启动对应 submission worker 后重试。",
  };
}

async function enqueueIndonesiaOfficialFeeCardJob(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
  cardSession: { redactedCard: unknown; expiresAtIso: string | null };
}): Promise<Response> {
  const now = new Date().toISOString();
  const queueStatus = queueStatusForApplication(input.application.country, input.application.visa_type, "live_assisted");
  const provider = queueProviderForApplication(input.application.country, input.application.visa_type, "live_assisted");
  if (!provider || !queueStatus.startsWith("id_")) {
    return NextResponse.json({ error: "Unsupported Indonesia official payment application." }, { status: 422 });
  }

  const { data: queue, error: queueError } = await input.admin
    .from("submission_queue")
    .insert({
      application_id: input.applicationId,
      user_id: input.userId,
      status: queueStatus,
      mode: "live_assisted",
      provider,
      current_stage: "payment_authorized",
      manual_action_status: "completed",
      payment_status: "authorized",
      official_status: "payment_authorized",
      vn_result_payload: {
        status: "payment_authorized",
        oneTimeCardSession: {
          present: true,
          expiresAtIso: input.cardSession.expiresAtIso,
          redactedCard: input.cardSession.redactedCard,
        },
      },
      attempts: 0,
      heartbeat_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (queueError || !queue) {
    return NextResponse.json({ error: queueError?.message ?? "Could not enqueue Indonesia payment job." }, { status: 500 });
  }

  const [applicationUpdateResult, eventResult] = await Promise.all([
    input.admin
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_queued",
        updated_at: now,
      })
      .eq("id", input.applicationId),
    input.admin.from("application_events").insert(
      {
        application_id: input.applicationId,
        applicant_id: input.profileId,
        auth_user_id: input.userId,
        event_type: "official_fee_payment_queued",
        actor_type: "user",
        actor_id: input.userId,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-payment-queued:${input.applicationId}:indonesia:${(queue as { id: string }).id}`,
        message: "Indonesia official-fee payment job was queued from the client confirmation tab.",
        metadata: {
          queue_id: (queue as { id: string }).id,
          queue_status: queueStatus,
          one_time_card_session: true,
          redacted_card: input.cardSession.redactedCard,
        },
        occurred_at: now,
        created_at: now,
      },
    ),
  ]);

  if (applicationUpdateResult.error && !isSchemaMissing(applicationUpdateResult.error)) {
    return NextResponse.json({ error: applicationUpdateResult.error.message }, { status: 500 });
  }
  if (eventResult.error && !isSchemaMissing(eventResult.error) && !isDuplicateKey(eventResult.error)) {
    return NextResponse.json({ error: eventResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    queueId: (queue as { id: string }).id,
    queueStatus,
    provider,
    cardSession: {
      expiresAtIso: input.cardSession.expiresAtIso,
      redactedCard: input.cardSession.redactedCard,
    },
    schemaWarning: applicationUpdateResult.error ? "official_fee_application_columns_missing" : null,
  });
}

export async function POST(
  request: Request,
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
  const { data: profileData, error: profileError } = await admin
    .from("applicant_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  const profile = profileData as ProfileRow | null;
  if (!profile) {
    return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  }

  const { data: applicationData, error: applicationError } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, submission_result, government_fee_cents, government_fee_currency")
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
  const isVietnamApplication = isVietnamEVisa(application);
  const isIndonesiaApplication = isIndonesiaEVisaApplication(application.country, application.visa_type);
  if (!isVietnamApplication && !isIndonesiaApplication) {
    return NextResponse.json({ error: "Official payment queue is only enabled for Vietnam and Indonesia e-Visa applications." }, { status: 422 });
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const card = normalizeCardBody(body);
  if (!card) {
    return NextResponse.json({ error: "请输入本次付款使用的银行卡号、有效期和 CVV。VIZA 不会保存这些信息。" }, { status: 400 });
  }

  if (isIndonesiaApplication) {
    const cardSession = await registerOneTimeCardSession(applicationId, application, card);
    if (!cardSession.ok) {
      return NextResponse.json(
        {
          error: cardSession.error,
        },
        { status: 503 },
      );
    }
    return enqueueIndonesiaOfficialFeeCardJob({
      admin,
      application,
      applicationId,
      profileId: profile.id,
      userId: user.id,
      cardSession,
    });
  }

  const { data: intent, error: intentError } = await admin
    .from("official_fee_payment_intents")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (intentError && !isSchemaMissing(intentError)) {
    return NextResponse.json({ error: intentError.message }, { status: 500 });
  }

  let intentRow: { id: string; status?: string | null; schemaFallback?: boolean } | null = null;
  if (intent) {
    intentRow = intent as { id: string; status?: string | null };
  } else if (intentError && isSchemaMissing(intentError)) {
    const { data: fallbackConsent, error: fallbackConsentError } = await admin
      .from("consent_events")
      .select("id, accepted, created_at")
      .eq("application_id", applicationId)
      .eq("auth_user_id", user.id)
      .eq("consent_type", "official_fee_payment_authorization")
      .eq("accepted", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallbackConsentError && !isSchemaMissing(fallbackConsentError)) {
      return NextResponse.json({ error: fallbackConsentError.message }, { status: 500 });
    }
    if (fallbackConsent) {
      intentRow = { id: `fallback:${applicationId}`, status: "admin_approved", schemaFallback: true };
    } else {
      const fallbackConsentResult = await recordFallbackOfficialFeeConsent({
        admin,
        application,
        applicationId,
        profileId: profile.id,
        userId: user.id,
      });
      if (!fallbackConsentResult.ok) {
        return NextResponse.json({ error: fallbackConsentResult.error }, { status: 500 });
      }
      intentRow = { id: `fallback:${applicationId}`, status: "admin_approved", schemaFallback: true };
    }
  }

  if (!intentRow) {
    const createdIntent = await createOfficialFeeIntentFromPaymentRequest({
      admin,
      application,
      applicationId,
      profileId: profile.id,
      userId: user.id,
    });
    if (!createdIntent.ok) {
      return NextResponse.json({ error: createdIntent.error }, { status: createdIntent.status ?? 500 });
    }
    intentRow = createdIntent.intentRow;
  }

  if (!["admin_approved", "ready", "manual_review", "failed", "pending"].includes(intentRow.status ?? "")) {
    return NextResponse.json({ error: `Official fee intent is not payable from status ${intentRow.status ?? "(empty)"}.` }, { status: 409 });
  }

  const cardSession = await registerOneTimeCardSession(applicationId, application, card);
  if (!cardSession.ok) {
    return NextResponse.json(
      {
        error: `无法把一次性银行卡会话发送给本机 submission-service：${cardSession.error}。请确认已运行 npm run vn:autopay:dev，且端口与 SUBMISSION_SERVICE_LOCAL_URL 匹配。`,
      },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();
  const registrationCode = readRegistrationCode(application.submission_result);
  const queueStatus = registrationCode ? "vn_payment_pending" : "vn_live_assisted_pending";
  const { data: queue, error: queueError } = await admin
    .from("submission_queue")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      status: queueStatus,
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      current_stage: "payment_authorized",
      manual_action_status: "completed",
      payment_status: "authorized",
      official_status: registrationCode ? "registration_code_captured" : "payment_authorized",
      vn_result_payload: {
        status: "payment_authorized",
        registrationCodeCaptured: Boolean(registrationCode),
        officialFeePaymentIntentId: intentRow.schemaFallback ? null : intentRow.id,
        officialFeeSchemaFallback: Boolean(intentRow.schemaFallback),
        oneTimeCardSession: {
          present: true,
          expiresAtIso: cardSession.expiresAtIso,
          redactedCard: cardSession.redactedCard,
        },
      },
      attempts: 0,
      heartbeat_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (queueError || !queue) {
    return NextResponse.json({ error: queueError?.message ?? "Could not enqueue Vietnam payment job." }, { status: 500 });
  }

  const [applicationUpdateResult, eventResult] = await Promise.all([
    admin
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_queued",
        ...(intentRow.schemaFallback ? {} : { official_fee_payment_intent_id: intentRow.id }),
        updated_at: now,
      })
      .eq("id", applicationId),
    admin.from("application_events").insert(
      {
        application_id: applicationId,
        applicant_id: profile.id,
        auth_user_id: user.id,
        event_type: "official_fee_payment_queued",
        actor_type: "user",
        actor_id: user.id,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-payment-queued:${applicationId}:${intentRow.id}:${(queue as { id: string }).id}`,
        message: "Vietnam official-fee payment job was queued from the client confirmation tab.",
        metadata: {
          intent_id: intentRow.id,
          queue_id: (queue as { id: string }).id,
          queue_status: queueStatus,
          one_time_card_session: true,
          redacted_card: cardSession.redactedCard,
        },
        occurred_at: now,
        created_at: now,
      },
    ),
  ]);

  if (applicationUpdateResult.error && !isSchemaMissing(applicationUpdateResult.error)) {
    return NextResponse.json({ error: applicationUpdateResult.error.message }, { status: 500 });
  }
  if (eventResult.error && !isSchemaMissing(eventResult.error) && !isDuplicateKey(eventResult.error)) {
    return NextResponse.json({ error: eventResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    queueId: (queue as { id: string }).id,
    queueStatus,
    intentId: intentRow.id,
    cardSession: {
      expiresAtIso: cardSession.expiresAtIso,
      redactedCard: cardSession.redactedCard,
    },
    schemaWarning: applicationUpdateResult.error ? "official_fee_application_columns_missing" : null,
  });
}
