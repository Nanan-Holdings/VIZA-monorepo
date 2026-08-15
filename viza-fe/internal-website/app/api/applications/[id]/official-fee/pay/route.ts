import { type NextRequest, NextResponse } from "next/server";
import {
  ensureFlyMachineStarted,
  waitForHttpReady,
} from "@/lib/fly-machine-wake.server";
import { isRunnerCutoverPaused } from "@/lib/runner-cutover-pause.server";
import {
  isIndonesiaEVisaApplication,
  queueProviderForApplication,
  queueStatusForApplication,
} from "@/lib/submission-queue";
import { enqueueRunnerJob } from "@/lib/queue/enqueue";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOfficialFeeApplicantAuth } from "../auth";
import {
  ensureVietnamCardWorkerReady,
  recoverVietnamCardHandoff,
  VIETNAM_CARD_HANDOFF_BUDGET_MS,
  vietnamCardPostTimeoutMs,
  vietnamCardReadinessTimeoutMs,
  vietnamCardWakeTimeoutMs,
  wakeQueuedVietnamPaymentJob,
} from "./cloud-worker-ready";
import {
  isEligibleGovernmentFeeAllocation,
  normalizeOfficialFeePaymentMethod,
  officialFeeCheckoutUrl,
  resolveManagedOfficialFee,
  type GovernmentFeeAllocationInput,
  type OfficialFeePaymentMethod,
} from "./managed-payment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

type CardSessionErrorCode =
  | "worker_start_failed"
  | "worker_readiness_timeout"
  | "card_handoff_failed"
  | "card_session_not_configured";

type CardSessionResult =
  | { ok: true; redactedCard: unknown; expiresAtIso: string | null }
  | { ok: false; error: string; errorCode: CardSessionErrorCode };

type OfficialFeeQueueResult = {
  queueId: string;
  queueStatus: string;
  provider: string;
  reusedExisting: boolean;
  supersededCount: number;
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

async function enqueueIsolatedOfficialFeeJob(input: {
  admin: ReturnType<typeof createAdminClient>;
  applicationId: string;
  userId: string;
  status: string;
  provider: string;
  currentStage: string;
  manualActionStatus: string;
  paymentStatus: string;
  officialStatus: string;
  resultPayload: Record<string, unknown>;
  now: string;
}): Promise<{ result: OfficialFeeQueueResult | null; error: string | null }> {
  const { data, error } = await input.admin.rpc("enqueue_official_fee_submission", {
    p_application_id: input.applicationId,
    p_user_id: input.userId,
    p_status: input.status,
    p_provider: input.provider,
    p_current_stage: input.currentStage,
    p_manual_action_status: input.manualActionStatus,
    p_payment_status: input.paymentStatus,
    p_official_status: input.officialStatus,
    p_result_payload: input.resultPayload,
    p_now: input.now,
  });
  if (error) {
    return { result: null, error: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const queueId = typeof row?.queue_id === "string" ? row.queue_id : "";
  const queueStatus = typeof row?.queue_status === "string" ? row.queue_status : "";
  const provider = typeof row?.queue_provider === "string" ? row.queue_provider : "";
  if (!queueId || !queueStatus || !provider) {
    return { result: null, error: "Official-fee queue RPC returned no job." };
  }

  return {
    result: {
      queueId,
      queueStatus,
      provider,
      reusedExisting: row?.reused_existing === true,
      supersededCount:
        typeof row?.superseded_count === "number"
          ? row.superseded_count
          : Number(row?.superseded_count ?? 0),
    },
    error: null,
  };
}

async function recordFallbackOfficialFeeConsent(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const resolvedFee = resolveManagedOfficialFee(input.application);
  if (!resolvedFee.ok) return { ok: false, error: resolvedFee.message };
  const amount = resolvedFee.amountCents / 100;
  const currency = resolvedFee.currency;
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
  paymentMethod: OfficialFeePaymentMethod;
}): Promise<
  | { ok: true; intentRow: { id: string; status?: string | null; schemaFallback?: boolean } }
  | { ok: false; error: string; status?: number }
> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const resolvedFee = resolveManagedOfficialFee(input.application);
  if (!resolvedFee.ok) {
    return { ok: false, error: resolvedFee.message, status: 422 };
  }
  const descriptor = resolvedFee.catalog;
  const amount = resolvedFee.amountCents / 100;
  const currency = resolvedFee.currency;
  const managedCard = input.paymentMethod === "viza_managed_virtual_card";

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
            country_code: descriptor.countryCode,
            visa_type: input.application.visa_type,
            official_fee_amount: amount,
            official_fee_currency: currency,
            total_charge_amount: amount,
            total_charge_currency: currency,
            fee_source: descriptor.feeSource,
            fee_source_url: descriptor.officialUrl,
            fee_breakdown_json: {
              source: descriptor.feeSource,
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
        accepted_text: managedCard
          ? `我授权 VIZA 为本申请开立限额虚拟卡并向${descriptor.targetPayee}支付本次官方签证费。`
          : `我授权 VIZA 使用本次一次性银行卡信息代我向${descriptor.targetPayee}支付本次官方签证费。`,
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
      idempotency_key: `official-fee-consent:${input.applicationId}:${quoteId}:${input.userId}:${input.paymentMethod}`,
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
    .eq("payment_method_type", input.paymentMethod)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingIntentError) {
    return { ok: false, error: existingIntentError.message, status: 500 };
  }
  if (existingIntent) {
    return { ok: true, intentRow: existingIntent as { id: string; status?: string | null } };
  }

  const idempotencyKey = `official-fee:${input.applicationId}:${quoteId}:${input.paymentMethod}:company_advance`;
  const { data: insertedIntent, error: insertIntentError } = await input.admin
    .from("official_fee_payment_intents")
    .insert({
      application_id: input.applicationId,
      user_id: input.userId,
      fee_quote_id: quoteId,
      country_code: descriptor.countryCode,
      provider: descriptor.provider,
      mode: managedCard || process.env.VN_OFFICIAL_PAYMENT_AUTOPAY === "true" ? "live" : "manual",
      official_fee_amount: amount,
      official_fee_currency: currency,
      target_payee: descriptor.targetPayee,
      target_site: descriptor.officialUrl,
      payment_method_type: input.paymentMethod,
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
        idempotency_key: `official-fee-authorized:${input.applicationId}:${quoteId}:${input.paymentMethod}`,
        message: managedCard
          ? "User authorized VIZA-managed virtual-card payment for the official fee."
          : "User authorized VIZA to pay the official fee from the one-time payment card form.",
        metadata: {
          quote_id: quoteId,
          intent_id: (insertedIntent as { id: string }).id,
          amount,
          currency,
          payment_method_type: input.paymentMethod,
        },
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

function getIndonesiaCloudCardSessionConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.INDONESIA_SUBMISSION_SERVICE_URL
    ?.trim()
    .replace(/\/+$/, "");
  const token = process.env.INDONESIA_CARD_SESSION_INTERNAL_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  if (process.env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) return null;
  return { baseUrl, token };
}

function getVietnamCloudCardSessionConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (
    process.env.VIETNAM_SUBMISSION_SERVICE_URL ??
    process.env.SUBMISSION_SERVICE_CLOUD_URL
  )?.trim().replace(/\/+$/, "");
  const token = process.env.VIETNAM_CARD_SESSION_INTERNAL_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  if (process.env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) return null;
  return { baseUrl, token };
}

function getIndonesiaOfficialFeeRelayUrl(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const baseUrl = (
    process.env.INDONESIA_OFFICIAL_FEE_RELAY_URL ?? "https://app.viza.it.com"
  ).trim().replace(/\/+$/, "");
  if (!baseUrl?.startsWith("https://")) return null;
  return baseUrl;
}

async function relayIndonesiaOfficialFeePayment(input: {
  request: Request;
  relayBaseUrl: string;
  applicationId: string;
  card: OneTimeCardInput;
}): Promise<Response> {
  const cookie = input.request.headers.get("cookie");
  if (!cookie) {
    return NextResponse.json({ error: "本地登录会话不可用，无法安全转交云端付款。" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${input.relayBaseUrl}/api/applications/${encodeURIComponent(input.applicationId)}/official-fee/pay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ card: input.card }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      },
    );
    const contentType = response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("Could not relay Indonesia official-fee payment to production", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "印尼云端付款转交失败，请稍后重试。" }, { status: 503 });
  }
}

function officialFeeCardSessionPath(application: ApplicationRow): "vietnam" | "indonesia" {
  return isIndonesiaEVisaApplication(application.country, application.visa_type) ? "indonesia" : "vietnam";
}

async function postOneTimeCardSession(input: {
  endpoint: string;
  applicationId: string;
  card: OneTimeCardInput;
  token?: string;
  deadlineAt?: number;
  maxAttempts?: number;
}): Promise<
  | { ok: true; redactedCard: unknown; expiresAtIso: string | null }
  | { ok: false; error: string; retryable?: boolean }
> {
  let lastError = "unknown card-session error";
  const maxAttempts = Math.max(1, Math.min(3, input.maxAttempts ?? 3));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const requestTimeoutMs = input.deadlineAt
      ? vietnamCardPostTimeoutMs(input.deadlineAt)
      : 15_000;
    if (requestTimeoutMs <= 0) {
      return {
        ok: false,
        error: "card_session_handoff_timeout",
        retryable: false,
      };
    }
    try {
      const response = await fetch(input.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
        },
        body: JSON.stringify({
          applicationId: input.applicationId,
          card: {
            pan: input.card.pan,
            expiry: input.card.expiry,
            cvv: input.card.cvv,
            holderName: input.card.holderName,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.ok) {
        return {
          ok: true,
          redactedCard: payload?.redactedCard ?? null,
          expiresAtIso: typeof payload?.expiresAtIso === "string" ? payload.expiresAtIso : null,
        };
      }

      lastError = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
      if (response.status < 500 && ![408, 425, 429].includes(response.status)) {
        return { ok: false, error: lastError, retryable: false };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxAttempts) {
      const remainingMs = input.deadlineAt
        ? Math.max(0, input.deadlineAt - Date.now())
        : attempt * 500;
      const backoffMs = Math.min(attempt * 500, remainingMs);
      if (backoffMs <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  return { ok: false, error: lastError, retryable: true };
}

async function registerOneTimeCardSession(
  applicationId: string,
  application: ApplicationRow,
  card: OneTimeCardInput,
  options: { vietnamDeadlineAt?: number } = {},
): Promise<
  CardSessionResult
> {
  const countryPath = officialFeeCardSessionPath(application);
  if (countryPath === "vietnam") {
    const cloud = getVietnamCloudCardSessionConfig();
    if (cloud) {
      const deadlineAt = options.vietnamDeadlineAt
        ?? Date.now() + VIETNAM_CARD_HANDOFF_BUDGET_MS;
      const result = await recoverVietnamCardHandoff({
        maxAttempts: 3,
        deadlineAt,
        ensureReady: () => ensureVietnamCardWorkerReady({
          baseUrl: cloud.baseUrl,
          wakeLegacy: () => ensureFlyMachineStarted("legacy"),
          wakeTimeoutMs: vietnamCardWakeTimeoutMs(deadlineAt),
          waitUntilReady: (url) => {
            const timeoutMs = vietnamCardReadinessTimeoutMs(deadlineAt);
            if (timeoutMs <= 0) {
              return Promise.resolve({
                ok: false as const,
                attempts: 0,
                reason: "readiness_timeout" as const,
              });
            }
            return waitForHttpReady(url, {
              timeoutMs,
              pollIntervalMs: 500,
              requestTimeoutMs: 3_000,
            });
          },
        }),
        postCardSession: () => postOneTimeCardSession({
          endpoint: `${cloud.baseUrl}/internal/vietnam/card-session`,
          applicationId,
          card,
          token: cloud.token,
          deadlineAt,
          maxAttempts: 1,
        }),
      });
      if (!result.ok && result.stage === "ready") {
        console.error("Vietnam cloud card-session worker unavailable", {
          reason: result.reason,
          attempts: result.attempts,
          wakeReason: result.wakeReason,
        });
        return {
          ok: false,
          errorCode: result.reason === "wake_failed" ? "worker_start_failed" : "worker_readiness_timeout",
          error: result.reason === "wake_failed"
            ? "越南云端付款服务暂时无法启动，请稍后重试。"
            : "越南云端付款服务仍在启动，请稍后重试。",
        };
      }
      if (!result.ok) {
        console.error("Could not register Vietnam cloud card session", {
          reason: result.error,
        });
        return {
          ok: false,
          errorCode: "card_handoff_failed",
          error: "越南云端付款会话暂时不可用，请稍后重试。",
        };
      }
      return result;
    }
    if (process.env.NODE_ENV === "production") {
      console.error("Vietnam cloud card session is not configured.");
      return {
        ok: false,
        errorCode: "card_session_not_configured",
        error: "越南云端付款会话尚未配置，请联系 VIZA 支持。",
      };
    }
  }
  if (countryPath === "indonesia") {
    const cloud = getIndonesiaCloudCardSessionConfig();
    if (cloud) {
      await ensureFlyMachineStarted("indonesia");
      const result = await postOneTimeCardSession({
        endpoint: `${cloud.baseUrl}/internal/indonesia/card-session`,
        applicationId,
        card,
        token: cloud.token,
      });
      if (!result.ok) {
        console.error("Could not register Indonesia cloud card session", {
          reason: result.error,
        });
        return {
          ok: false,
          errorCode: "card_handoff_failed",
          error: "印尼云端付款会话暂时不可用，请稍后重试。",
        };
      }
      return result;
    }
    console.error("Indonesia cloud card session is not configured.");
    return {
      ok: false,
      errorCode: "card_session_not_configured",
      error: "印尼云端付款会话尚未配置，请联系 VIZA 支持。",
    };
  }

  const attempts: string[] = [];
  for (const baseUrl of getSubmissionServiceLocalUrlCandidates(countryPath)) {
    const endpoint = `${baseUrl}/local/${countryPath}/card-session`;
    const result = await postOneTimeCardSession({ endpoint, applicationId, card });
    if (result.ok) return result;
    attempts.push(result.error);
  }
  console.error("Could not register one-time official-fee card session", {
    countryPath,
    attempts,
  });
  return {
    ok: false,
    errorCode: "card_handoff_failed",
    error: "本机 submission-service 没有运行，或未开启一次性银行卡会话端点。请启动对应 submission worker 后重试。",
  };
}

async function discardVietnamOneTimeCardSession(applicationId: string): Promise<boolean> {
  const cloud = getVietnamCloudCardSessionConfig();
  const targets = cloud
    ? [{ endpoint: `${cloud.baseUrl}/internal/vietnam/card-session`, token: cloud.token }]
    : getSubmissionServiceLocalUrlCandidates("vietnam").map((baseUrl) => ({
        endpoint: `${baseUrl}/local/vietnam/card-session`,
        token: undefined,
      }));

  for (const target of targets) {
    try {
      const response = await fetch(target.endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(target.token ? { Authorization: `Bearer ${target.token}` } : {}),
        },
        body: JSON.stringify({ applicationId }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return true;
    } catch {
      // The worker TTL remains the final safety boundary if compensation
      // cannot reach the process. Do not expose or log card material here.
    }
  }
  return false;
}

async function enqueueIndonesiaOfficialFeeCardJob(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
  cardSession?: { redactedCard: unknown; expiresAtIso: string | null };
  intentId?: string;
  paymentMethod: OfficialFeePaymentMethod;
}): Promise<Response> {
  const now = new Date().toISOString();
  const queueStatus = queueStatusForApplication(input.application.country, input.application.visa_type, "live_assisted");
  const provider = queueProviderForApplication(input.application.country, input.application.visa_type, "live_assisted");
  if (!provider || !queueStatus.startsWith("id_")) {
    return NextResponse.json({ error: "Unsupported Indonesia official payment application." }, { status: 422 });
  }

  const queuePayload = {
    status: "payment_authorized",
    officialFeePaymentIntentId: input.intentId ?? null,
    paymentMethod: input.paymentMethod,
    oneTimeCardSession: input.cardSession
      ? {
          present: true,
          expiresAtIso: input.cardSession.expiresAtIso,
          redactedCard: input.cardSession.redactedCard,
        }
      : { present: false },
  };
  const queueEnqueue = await enqueueIsolatedOfficialFeeJob({
    admin: input.admin,
    applicationId: input.applicationId,
    userId: input.userId,
    status: queueStatus,
    provider,
    currentStage: "payment_authorized",
    manualActionStatus: "completed",
    paymentStatus: "authorized",
    officialStatus: "payment_authorized",
    resultPayload: queuePayload,
    now,
  });
  if (queueEnqueue.error || !queueEnqueue.result) {
    return NextResponse.json(
      { error: queueEnqueue.error ?? "Could not enqueue Indonesia payment job." },
      { status: 500 },
    );
  }
  const queue = queueEnqueue.result;

  const [applicationUpdateResult, eventResult] = await Promise.all([
    input.admin
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_queued",
        ...(input.intentId ? { official_fee_payment_intent_id: input.intentId } : {}),
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
        idempotency_key: `official-fee-payment-queued:${input.applicationId}:indonesia:${queue.queueId}`,
        message: queue.reusedExisting
          ? "Indonesia official-fee payment request reused the already claimed job."
          : "Indonesia official-fee payment job was queued from the client confirmation tab.",
        metadata: {
          queue_id: queue.queueId,
          queue_status: queue.queueStatus,
          one_time_card_session: Boolean(input.cardSession),
          managed_virtual_card: input.paymentMethod === "viza_managed_virtual_card",
          reused_existing: queue.reusedExisting,
          superseded_count: queue.supersededCount,
          ...(input.cardSession ? { redacted_card: input.cardSession.redactedCard } : {}),
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
    queueId: queue.queueId,
    queueStatus: queue.queueStatus,
    provider: queue.provider,
    reusedExisting: queue.reusedExisting,
    supersededCount: queue.supersededCount,
    cardSession: input.cardSession
      ? {
          expiresAtIso: input.cardSession.expiresAtIso,
          redactedCard: input.cardSession.redactedCard,
        }
      : null,
    paymentMethod: input.paymentMethod,
    schemaWarning: applicationUpdateResult.error ? "official_fee_application_columns_missing" : null,
  });
}

function officialFeeFundingRequiredResponse(applicationId: string): Response {
  return NextResponse.json(
    {
      error: "Official-fee funding must be reserved before VIZA can issue the application card.",
      code: "official_fee_funding_required",
      errorCode: "official_fee_funding_required",
      checkoutUrl: officialFeeCheckoutUrl(applicationId),
    },
    { status: 409 },
  );
}

async function loadGovernmentFeeAllocation(input: {
  admin: ReturnType<typeof createAdminClient>;
  applicationId: string;
}): Promise<{ allocation: GovernmentFeeAllocationInput | null; error: string | null }> {
  const { data, error } = await input.admin
    .from("government_fee_allocations")
    .select("id, amount_cents, currency, state")
    .eq("application_id", input.applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { allocation: null, error: error.message };
  return {
    allocation: data as GovernmentFeeAllocationInput | null,
    error: null,
  };
}

async function enqueueManagedOfficialFeeRunner(input: {
  admin: ReturnType<typeof createAdminClient>;
  application: ApplicationRow;
  applicationId: string;
  profileId: string;
  userId: string;
  intentId: string;
}): Promise<Response> {
  const resolvedFee = resolveManagedOfficialFee(input.application);
  if (!resolvedFee.ok) {
    return NextResponse.json(
      { error: resolvedFee.message, errorCode: resolvedFee.code },
      { status: 422 },
    );
  }
  if (!resolvedFee.catalog.runnerCountry) {
    return NextResponse.json(
      {
        error: "This official-fee route is configured for VIZA-managed payment, but its payment runner is not available yet.",
        errorCode: "official_fee_runner_unavailable",
      },
      { status: 409 },
    );
  }

  let job: { id: string; created: boolean };
  try {
    job = await enqueueRunnerJob(
      input.applicationId,
      resolvedFee.catalog.runnerCountry,
      {
        correlationId: `official-fee:${input.applicationId}:${input.intentId}`,
        metadata: {
          trigger: "official_fee_payment",
          official_fee_payment: true,
          official_fee_payment_intent_id: input.intentId,
          official_fee_country_code: resolvedFee.catalog.countryCode,
          official_fee_provider: resolvedFee.catalog.provider,
          official_fee_amount_cents: resolvedFee.amountCents,
          official_fee_currency: resolvedFee.currency,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        errorCode: "official_fee_runner_enqueue_failed",
      },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();
  const postEnqueueWarnings: string[] = [];
  const [applicationUpdateResult, eventResult] = await Promise.all([
    input.admin
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_queued",
        official_fee_payment_intent_id: input.intentId,
        updated_at: now,
      })
      .eq("id", input.applicationId),
    input.admin.from("application_events").insert({
      application_id: input.applicationId,
      applicant_id: input.profileId,
      auth_user_id: input.userId,
      event_type: "official_fee_payment_queued",
      actor_type: "user",
      actor_id: input.userId,
      source: "official_fee",
      visibility: "staff",
      idempotency_key: `official-fee-payment-queued:${input.applicationId}:${input.intentId}:${job.id}`,
      message: job.created
        ? "VIZA-managed official-fee runner job was queued."
        : "VIZA-managed official-fee payment reused an active runner job.",
      metadata: {
        intent_id: input.intentId,
        runner_job_id: job.id,
        runner_job_created: job.created,
        managed_virtual_card: true,
        country_code: resolvedFee.catalog.countryCode,
        provider: resolvedFee.catalog.provider,
      },
      occurred_at: now,
      created_at: now,
    }),
  ]);
  if (applicationUpdateResult.error && !isSchemaMissing(applicationUpdateResult.error)) {
    postEnqueueWarnings.push("application_status_update_failed");
  }
  if (eventResult.error && !isSchemaMissing(eventResult.error) && !isDuplicateKey(eventResult.error)) {
    postEnqueueWarnings.push("application_event_insert_failed");
  }

  return NextResponse.json({
    ok: true,
    queueId: job.id,
    queueStatus: job.created ? "queued" : "active_job_reused",
    intentId: input.intentId,
    paymentMethod: "viza_managed_virtual_card",
    postEnqueueWarnings,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const vietnamCardHandoffDeadlineAt = Date.now() + VIETNAM_CARD_HANDOFF_BUDGET_MS;
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const auth = await resolveOfficialFeeApplicantAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const profile: ProfileRow = { id: auth.profileId };

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

  if (isRunnerCutoverPaused()) {
    return NextResponse.json(
      {
        error: "Official-fee submission is temporarily paused for a controlled runner cutover.",
        errorCode: "runner_cutover_paused",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const paymentMethod = normalizeOfficialFeePaymentMethod(body);
  const managedCard = paymentMethod === "viza_managed_virtual_card";
  const card = normalizeCardBody(body);
  const resolvedFee = resolveManagedOfficialFee(application);
  if (!resolvedFee.ok) {
    return NextResponse.json(
      { error: resolvedFee.message, errorCode: resolvedFee.code },
      { status: 422 },
    );
  }
  if (!managedCard && !isVietnamApplication && !isIndonesiaApplication) {
    return NextResponse.json(
      {
        error: "One-time applicant cards are supported only for the legacy Vietnam and Indonesia payment flows.",
        errorCode: "one_time_card_not_supported",
      },
      { status: 422 },
    );
  }
  if (!managedCard && !card) {
    return NextResponse.json({ error: "请输入本次付款使用的银行卡号、有效期和 CVV。VIZA 不会保存这些信息。" }, { status: 400 });
  }

  if (managedCard) {
    const allocationResult = await loadGovernmentFeeAllocation({ admin, applicationId });
    if (allocationResult.error) {
      if (isSchemaMissing({ message: allocationResult.error })) {
        return officialFeeFundingRequiredResponse(applicationId);
      }
      return NextResponse.json({ error: allocationResult.error }, { status: 500 });
    }
    if (!isEligibleGovernmentFeeAllocation(allocationResult.allocation, resolvedFee)) {
      return officialFeeFundingRequiredResponse(applicationId);
    }
  }

  if (isIndonesiaApplication && !managedCard && card && card.holderName.length < 2) {
    return NextResponse.json(
      { error: "请输入银行卡上的持卡人姓名，以便印尼官方支付网关发起银行验证。" },
      { status: 400 },
    );
  }

  if (isIndonesiaApplication) {
    if (managedCard) {
      const createdIntent = await createOfficialFeeIntentFromPaymentRequest({
        admin,
        application,
        applicationId,
        profileId: profile.id,
        userId: auth.actorId,
        paymentMethod,
      });
      if (!createdIntent.ok) {
        return NextResponse.json({ error: createdIntent.error }, { status: createdIntent.status ?? 500 });
      }
      if (!["admin_approved", "ready", "manual_review", "failed", "pending"].includes(createdIntent.intentRow.status ?? "")) {
        return NextResponse.json(
          { error: `Official fee intent is not payable from status ${createdIntent.intentRow.status ?? "(empty)"}.` },
          { status: 409 },
        );
      }
      return enqueueIndonesiaOfficialFeeCardJob({
        admin,
        application,
        applicationId,
        profileId: profile.id,
        userId: auth.actorId,
        intentId: createdIntent.intentRow.id,
        paymentMethod,
      });
    }
    if (!card) {
      return NextResponse.json({ error: "Missing one-time card details." }, { status: 400 });
    }
    const relayBaseUrl = getIndonesiaOfficialFeeRelayUrl();
    if (relayBaseUrl) {
      return relayIndonesiaOfficialFeePayment({
        request,
        relayBaseUrl,
        applicationId,
        card,
      });
    }
    const cardSession = await registerOneTimeCardSession(applicationId, application, card);
    if (!cardSession.ok) {
      return NextResponse.json(
        {
          error: cardSession.error,
          errorCode: cardSession.errorCode,
        },
        { status: 503 },
      );
    }
    return enqueueIndonesiaOfficialFeeCardJob({
      admin,
      application,
      applicationId,
      profileId: profile.id,
      userId: auth.actorId,
      cardSession,
      paymentMethod,
    });
  }

  if (!isVietnamApplication) {
    const createdIntent = await createOfficialFeeIntentFromPaymentRequest({
      admin,
      application,
      applicationId,
      profileId: profile.id,
      userId: auth.actorId,
      paymentMethod: "viza_managed_virtual_card",
    });
    if (!createdIntent.ok) {
      return NextResponse.json(
        { error: createdIntent.error },
        { status: createdIntent.status ?? 500 },
      );
    }
    if (![
      "admin_approved",
      "ready",
      "manual_review",
      "failed",
      "pending",
    ].includes(createdIntent.intentRow.status ?? "")) {
      return NextResponse.json(
        { error: `Official fee intent is not payable from status ${createdIntent.intentRow.status ?? "(empty)"}.` },
        { status: 409 },
      );
    }
    return enqueueManagedOfficialFeeRunner({
      admin,
      application,
      applicationId,
      profileId: profile.id,
      userId: auth.actorId,
      intentId: createdIntent.intentRow.id,
    });
  }

  const { data: intent, error: intentError } = await admin
    .from("official_fee_payment_intents")
    .select("*")
    .eq("application_id", applicationId)
    .eq("payment_method_type", paymentMethod)
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
    if (managedCard) {
      return NextResponse.json(
        { error: "Managed virtual-card payment requires the durable official-fee schema." },
        { status: 503 },
      );
    }
    const { data: fallbackConsent, error: fallbackConsentError } = await admin
      .from("consent_events")
      .select("id, accepted, created_at")
      .eq("application_id", applicationId)
      .eq("auth_user_id", auth.actorId)
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
        userId: auth.actorId,
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
      userId: auth.actorId,
      paymentMethod,
    });
    if (!createdIntent.ok) {
      return NextResponse.json({ error: createdIntent.error }, { status: createdIntent.status ?? 500 });
    }
    intentRow = createdIntent.intentRow;
  }

  if (!["admin_approved", "ready", "manual_review", "failed", "pending"].includes(intentRow.status ?? "")) {
    return NextResponse.json({ error: `Official fee intent is not payable from status ${intentRow.status ?? "(empty)"}.` }, { status: 409 });
  }

  const cardSession = managedCard
    ? null
    : card
      ? await registerOneTimeCardSession(
          applicationId,
          application,
          card,
          { vietnamDeadlineAt: vietnamCardHandoffDeadlineAt },
        )
      : null;
  if (cardSession && !cardSession.ok) {
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "production"
          ? `无法把一次性银行卡会话发送给 VIZA 云端 submission-service：${cardSession.error}`
          : `无法把一次性银行卡会话发送给本机 submission-service：${cardSession.error}。请确认已运行 npm run vn:autopay:dev，且端口与 SUBMISSION_SERVICE_LOCAL_URL 匹配。`,
        errorCode: cardSession.errorCode,
      },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();
  const registrationCode = readRegistrationCode(application.submission_result);
  const queueStatus = registrationCode ? "vn_payment_pending" : "vn_cloud_live_pending";
  const queuePayload = {
    status: "payment_authorized",
    registrationCodeCaptured: Boolean(registrationCode),
    officialFeePaymentIntentId: intentRow.schemaFallback ? null : intentRow.id,
    officialFeeSchemaFallback: Boolean(intentRow.schemaFallback),
    paymentMethod,
    oneTimeCardSession: cardSession?.ok
      ? {
          present: true,
          expiresAtIso: cardSession.expiresAtIso,
          redactedCard: cardSession.redactedCard,
        }
      : { present: false },
  };
  const queueEnqueue = await enqueueIsolatedOfficialFeeJob({
    admin,
    applicationId,
    userId: auth.actorId,
    status: queueStatus,
    provider: "vietnam_evisa_live",
    currentStage: "payment_authorized",
    manualActionStatus: "completed",
    paymentStatus: "authorized",
    officialStatus: registrationCode ? "registration_code_captured" : "payment_authorized",
    resultPayload: queuePayload,
    now,
  });
  if (queueEnqueue.error || !queueEnqueue.result) {
    const cardSessionDiscarded = cardSession?.ok
      ? await discardVietnamOneTimeCardSession(applicationId)
      : false;
    console.error("Could not enqueue Vietnam payment job after card handoff", {
      reason: queueEnqueue.error ?? "missing queue result",
      cardSessionDiscarded,
    });
    return NextResponse.json(
      {
        error: "越南云端付款任务未能创建，本次银行卡会话已取消，请重新提交。",
        errorCode: "queue_enqueue_failed",
      },
      { status: 500 },
    );
  }
  const queue = queueEnqueue.result;
  const postEnqueueWarnings: string[] = [];

  const queueWake = await wakeQueuedVietnamPaymentJob(queue.queueId);
  if (!queueWake.ok) {
    postEnqueueWarnings.push("queue_wake_failed");
    console.error("Vietnam payment job queued but submission worker wake failed", {
      reason: queueWake.reason,
    });
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
        auth_user_id: auth.actorId,
        event_type: "official_fee_payment_queued",
        actor_type: "user",
        actor_id: auth.actorId,
        source: "official_fee",
        visibility: "staff",
        idempotency_key: `official-fee-payment-queued:${applicationId}:${intentRow.id}:${queue.queueId}`,
        message: queue.reusedExisting
          ? "Vietnam official-fee payment request reused the already claimed job."
          : "Vietnam official-fee payment job was queued from the client confirmation tab.",
        metadata: {
          intent_id: intentRow.id,
          queue_id: queue.queueId,
          queue_status: queue.queueStatus,
          one_time_card_session: Boolean(cardSession?.ok),
          managed_virtual_card: managedCard,
          reused_existing: queue.reusedExisting,
          superseded_count: queue.supersededCount,
          ...(cardSession?.ok ? { redacted_card: cardSession.redactedCard } : {}),
        },
        occurred_at: now,
        created_at: now,
      },
    ),
  ]);

  if (applicationUpdateResult.error && !isSchemaMissing(applicationUpdateResult.error)) {
    postEnqueueWarnings.push("application_status_update_failed");
    console.error("Vietnam payment job queued but application status update failed", {
      reason: applicationUpdateResult.error.message,
    });
  }
  if (eventResult.error && !isSchemaMissing(eventResult.error) && !isDuplicateKey(eventResult.error)) {
    postEnqueueWarnings.push("application_event_insert_failed");
    console.error("Vietnam payment job queued but audit event insert failed", {
      reason: eventResult.error.message,
    });
  }

  return NextResponse.json({
    ok: true,
    queueId: queue.queueId,
    queueStatus: queue.queueStatus,
    intentId: intentRow.id,
    reusedExisting: queue.reusedExisting,
    supersededCount: queue.supersededCount,
    cardSession: cardSession?.ok
      ? {
          expiresAtIso: cardSession.expiresAtIso,
          redactedCard: cardSession.redactedCard,
        }
      : null,
    paymentMethod,
    postEnqueueWarnings,
    schemaWarning: applicationUpdateResult.error ? "official_fee_application_columns_missing" : null,
  });
}
