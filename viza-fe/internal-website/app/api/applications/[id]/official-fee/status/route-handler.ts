import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOfficialFeeApplicantAuth } from "../auth";

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

export const VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES = [
  "vn_cloud_live_pending",
  "vn_live_assisted_pending",
  "vn_live_assisted_processing",
  "vn_payment_pending",
  "vn_payment_processing",
  "vn_payment_paid",
  "vn_payment_failed",
  "vn_live_assisted_failed",
  "vn_blocked",
] as const;

const ACTIVE_VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES = new Set<string>([
  "vn_cloud_live_pending",
  "vn_live_assisted_pending",
  "vn_live_assisted_processing",
  "vn_payment_pending",
  "vn_payment_processing",
]);

const FAILED_VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES = new Set<string>([
  "vn_payment_failed",
  "vn_live_assisted_failed",
  "vn_blocked",
]);

export function deriveVietnamOfficialFeeQueueState(
  paymentQueue: Record<string, unknown> | null,
): {
  queueId: string | null;
  paymentQueued: boolean;
  paymentNeedsOperator: boolean;
} {
  const status = typeof paymentQueue?.status === "string" ? paymentQueue.status : null;
  return {
    queueId: typeof paymentQueue?.id === "string" ? paymentQueue.id : null,
    paymentQueued: status !== null && ACTIVE_VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES.has(status),
    paymentNeedsOperator:
      (status !== null && FAILED_VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES.has(status)) ||
      paymentQueue?.payment_status === "manual_review",
  };
}

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

async function loadOwnedApplication(request: NextRequest, applicationId: string): Promise<
  | { application: ApplicationRow; error: null }
  | { application: null; error: NextResponse }
> {
  const auth = await resolveOfficialFeeApplicantAuth(request);
  if (!auth.ok) {
    return { application: null, error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }

  const admin = createAdminClient();
  const profile: ProfileRow = { id: auth.profileId };

  let application: ApplicationRow | null = null;
  const { data, error } = await admin
    .from("applications")
    .select("id, applicant_id, country, visa_type, official_fee_status, official_fee_quote_id, official_fee_payment_intent_id, official_fee_receipt_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    if (!isSchemaMissing(error)) {
      return { application: null, error: NextResponse.json({ error: error.message }, { status: 500 }) };
    }
    const fallback = await admin
      .from("applications")
      .select("id, applicant_id, country, visa_type")
      .eq("id", applicationId)
      .maybeSingle();
    if (fallback.error) {
      return { application: null, error: NextResponse.json({ error: fallback.error.message }, { status: 500 }) };
    }
    application = fallback.data
      ? {
          ...(fallback.data as ApplicationRow),
          official_fee_status: null,
          official_fee_quote_id: null,
          official_fee_payment_intent_id: null,
          official_fee_receipt_id: null,
        }
      : null;
  } else {
    application = data as ApplicationRow | null;
  }
  if (!application) {
    return { application: null, error: NextResponse.json({ error: "Application not found" }, { status: 404 }) };
  }
  if (application.applicant_id !== profile.id) {
    return { application: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { application, error: null };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: applicationId } = await context.params;
  if (!applicationId) {
    return NextResponse.json({ error: "Missing application id" }, { status: 400 });
  }

  const owned = await loadOwnedApplication(request, applicationId);
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

  const queueResult = await admin
    .from("submission_queue")
    .select("id, status, current_stage, payment_status, official_status, updated_at")
    .eq("application_id", applicationId)
    .in("status", [...VIETNAM_OFFICIAL_FEE_QUEUE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (queueResult.error && !isSchemaMissing(queueResult.error)) {
    return NextResponse.json({ error: queueResult.error.message }, { status: 500 });
  }

  const paymentQueue = queueResult.data as Record<string, unknown> | null;
  const paymentQueueState = deriveVietnamOfficialFeeQueueState(paymentQueue);

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
      paymentQueue,
      ...paymentQueueState,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
