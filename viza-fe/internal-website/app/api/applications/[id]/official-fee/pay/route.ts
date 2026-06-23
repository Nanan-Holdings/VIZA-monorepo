import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string };
type ApplicationRow = {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  submission_result?: unknown;
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

async function registerOneTimeCardSession(applicationId: string, card: OneTimeCardInput): Promise<
  | { ok: true; redactedCard: unknown; expiresAtIso: string | null }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(`${getSubmissionServiceLocalUrl()}/local/vietnam/card-session`, {
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
      return {
        ok: false,
        error:
          typeof payload?.error === "string"
            ? payload.error
            : `submission-service card session returned ${response.status}`,
      };
    }
    return {
      ok: true,
      redactedCard: payload?.redactedCard ?? null,
      expiresAtIso: typeof payload?.expiresAtIso === "string" ? payload.expiresAtIso : null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
    .select("id, applicant_id, country, visa_type, submission_result")
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
  if (!isVietnamEVisa(application)) {
    return NextResponse.json({ error: "Official payment queue is only enabled for Vietnam e-Visa." }, { status: 422 });
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
    }
  }

  if (!intentRow) {
    return NextResponse.json({ error: "请先授权 VIZA 代付本次越南 e-Visa 官方费用。" }, { status: 409 });
  }

  if (!["admin_approved", "ready", "manual_review", "failed", "pending"].includes(intentRow.status ?? "")) {
    return NextResponse.json({ error: `Official fee intent is not payable from status ${intentRow.status ?? "(empty)"}.` }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const card = normalizeCardBody(body);
  if (!card) {
    return NextResponse.json({ error: "请输入本次付款使用的银行卡号、有效期和 CVV。VIZA 不会保存这些信息。" }, { status: 400 });
  }

  const cardSession = await registerOneTimeCardSession(applicationId, card);
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
  const { data: queue, error: queueError } = await admin
    .from("submission_queue")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      status: "vn_payment_pending",
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
    intentId: intentRow.id,
    cardSession: {
      expiresAtIso: cardSession.expiresAtIso,
      redactedCard: cardSession.redactedCard,
    },
    schemaWarning: applicationUpdateResult.error ? "official_fee_application_columns_missing" : null,
  });
}
