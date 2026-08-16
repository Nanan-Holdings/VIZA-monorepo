import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAccountAndMagicLinkWithAdmin, type ProvisionedAccount } from "@/app/actions/wechat-provisioning";
import { assignApplicantInboxAlias } from "@/app/actions/applicant-inbox";
import { officialFeeCatalogFor, officialFeeCatalogKey } from "@/lib/payments/official-fee-catalog";
import { pricingFor } from "@/lib/pricing";
import { enqueueRunnerJob } from "@/lib/queue/enqueue";

export type CommercialPaymentProvider = "stripe" | "photonpay" | "wechat" | "free";

export const COMMERCIAL_PAYMENT_PAID_EVENT = "commercial_payment.paid";

export interface PaymentProvisioningJob {
  id: string;
  order_id: string;
  provider: CommercialPaymentProvider;
  status: "queued" | "running" | "retry" | "succeeded" | "dead_letter";
  user_status: "pending" | "completed";
  profile_status: "pending" | "completed";
  application_status: "pending" | "completed";
  inbox_status: "pending" | "completed";
  runner_status: "pending" | "completed";
  allocation_status: "pending" | "completed";
  attempts: number;
  max_attempts: number;
}

export interface PaymentLifecycleResult {
  eventId: string;
  jobId: string | null;
  replayed: boolean;
}

export interface ProvisioningStepRunner {
  loadAccount(orderId: string): Promise<ProvisionedAccount>;
  ensureAccount(orderId: string): Promise<ProvisionedAccount>;
  ensureAllocation(orderId: string): Promise<void>;
  ensureInbox(applicantId: string): Promise<void>;
  enqueueRunner(account: ProvisionedAccount, orderId: string, provider: CommercialPaymentProvider): Promise<void>;
  markStep(patch: Partial<Pick<PaymentProvisioningJob, "user_status" | "profile_status" | "application_status" | "inbox_status" | "runner_status" | "allocation_status">>): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rpcRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] ?? null : data;
}

export interface GovernmentFeeAllocationPlan {
  amountCents: number;
  currency: string;
  catalogKey: string;
  payee: string;
  description: string;
}

export function governmentFeeAllocationPlan(
  country: string,
  visaType: string,
): GovernmentFeeAllocationPlan | null {
  const catalog = officialFeeCatalogFor(country, visaType);
  const pricing = pricingFor(
    country,
    visaType.trim().toUpperCase() === "B211A" ? "ID_C1_TOURIST" : visaType,
  );
  if (
    catalog?.fundingClass !== "viza_managed_card"
    || !pricing
    || !Number.isSafeInteger(pricing.govtFeeCents)
    || pricing.govtFeeCents <= 0
  ) {
    return null;
  }
  return {
    amountCents: pricing.govtFeeCents,
    currency: pricing.currency.trim().toUpperCase(),
    catalogKey: officialFeeCatalogKey(catalog.country, catalog.visaType),
    payee: catalog.targetPayee,
    description: `Government fee reserve — ${catalog.country}/${catalog.visaType}`,
  };
}

/**
 * Records the provider event and creates the unique order job in one database
 * transaction. Callers must pass only redacted provider references here.
 */
export async function recordCommercialPaymentPaid(
  admin: SupabaseClient,
  params: {
    orderId: string;
    provider: CommercialPaymentProvider;
    providerEventId: string;
    payloadRedacted?: Record<string, unknown>;
  },
): Promise<PaymentLifecycleResult> {
  const providerEventId = params.providerEventId.trim();
  if (!providerEventId) throw new Error("provider event id is required");

  const { data, error } = await admin.rpc("record_payment_lifecycle_event", {
    p_provider: params.provider,
    p_provider_event_id: providerEventId,
    p_event_type: COMMERCIAL_PAYMENT_PAID_EVENT,
    p_order_id: params.orderId,
    p_payload_redacted: params.payloadRedacted ?? {},
  });
  if (error) throw new Error(`payment lifecycle record: ${error.message}`);

  const row = rpcRow(data as {
    event_id: string;
    job_id: string | null;
    event_replayed: boolean;
  } | {
    event_id: string;
    job_id: string | null;
    event_replayed: boolean;
  }[] | null);
  if (!row?.event_id) throw new Error("payment lifecycle record returned no event");
  return {
    eventId: row.event_id,
    jobId: row.job_id ?? null,
    replayed: Boolean(row.event_replayed),
  };
}

/**
 * Pure orchestration state machine. Each external side effect is followed by
 * a durable step update; if the process restarts before that update, the
 * effect is safe to repeat because each underlying producer is idempotent.
 */
export async function executePaymentProvisioningSteps(
  job: PaymentProvisioningJob,
  runner: ProvisioningStepRunner,
): Promise<void> {
  let account: ProvisionedAccount;
  if (job.user_status !== "completed" || job.profile_status !== "completed" || job.application_status !== "completed") {
    account = await runner.ensureAccount(job.order_id);
    await runner.markStep({
      user_status: "completed",
      profile_status: "completed",
      application_status: "completed",
    });
  } else {
    account = await runner.loadAccount(job.order_id);
  }

  if (job.allocation_status !== "completed") {
    await runner.ensureAllocation(job.order_id);
    await runner.markStep({ allocation_status: "completed" });
  }

  if (job.inbox_status !== "completed") {
    await runner.ensureInbox(account.applicantId);
    await runner.markStep({ inbox_status: "completed" });
  }

  if (job.runner_status !== "completed") {
    await runner.enqueueRunner(account, job.order_id, job.provider);
    await runner.markStep({ runner_status: "completed" });
  }
}

function workerId(): string {
  return `payment-provisioning:${crypto.randomUUID()}`;
}

async function loadAccount(admin: SupabaseClient, orderId: string): Promise<ProvisionedAccount> {
  const { data: order, error: orderError } = await admin
    .from("order")
    .select("applicant_id, application_id")
    .eq("id", orderId)
    .single();
  if (orderError || !order) throw new Error(`provisioning order lookup: ${orderError?.message ?? "not found"}`);

  const [{ data: profile, error: profileError }, { data: application, error: applicationError }] = await Promise.all([
    admin.from("applicant_profiles").select("id, auth_user_id").eq("id", order.applicant_id).single(),
    admin.from("applications").select("id, country, visa_type").eq("id", order.application_id).single(),
  ]);
  if (profileError || !profile) throw new Error(`provisioning profile lookup: ${profileError?.message ?? "not found"}`);
  if (applicationError || !application) throw new Error(`provisioning application lookup: ${applicationError?.message ?? "not found"}`);
  if (!profile.auth_user_id) throw new Error("provisioning auth user is not bound");

  return {
    authUserId: profile.auth_user_id,
    applicantId: profile.id,
    applicationId: application.id,
    country: application.country,
    visaType: application.visa_type,
  };
}

async function updateJobStep(
  admin: SupabaseClient,
  jobId: string,
  patch: Partial<Pick<PaymentProvisioningJob, "user_status" | "profile_status" | "application_status" | "inbox_status" | "runner_status" | "allocation_status">>,
): Promise<void> {
  const { error } = await admin
    .from("payment_provisioning_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "running");
  if (error) throw new Error(`payment provisioning step update: ${error.message}`);
}

export async function ensureGovernmentFeeAllocation(admin: SupabaseClient, orderId: string): Promise<void> {
  const { data: order, error: orderError } = await admin
    .from("order")
    .select("id, application_id")
    .eq("id", orderId)
    .single();
  if (orderError || !order) throw new Error(`allocation order lookup: ${orderError?.message ?? "not found"}`);

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("country, visa_type")
    .eq("id", order.application_id)
    .single();
  if (applicationError || !application) {
    throw new Error(`allocation application lookup: ${applicationError?.message ?? "not found"}`);
  }
  const plan = governmentFeeAllocationPlan(
    String(application.country ?? ""),
    String(application.visa_type ?? ""),
  );
  if (!plan) return;

  const { data: existing, error: existingError } = await admin
    .from("government_fee_allocations")
    .select("id, amount_cents, currency")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existingError) throw new Error(`allocation lookup: ${existingError.message}`);
  if (existing) {
    if (
      Number(existing.amount_cents) !== plan.amountCents
      || String(existing.currency ?? "").toUpperCase() !== plan.currency
    ) {
      throw new Error("existing government-fee allocation does not match package pricing");
    }
    return;
  }

  const { data: line, error: lineError } = await admin
    .from("order_line")
    .select("id, amount_cents, currency")
    .eq("order_id", orderId)
    .eq("kind", "govt")
    .maybeSingle();
  if (lineError) throw new Error(`allocation line lookup: ${lineError.message}`);
  let orderLine = line;
  if (orderLine) {
    if (
      Number(orderLine.amount_cents) !== plan.amountCents
      || String(orderLine.currency ?? "").toUpperCase() !== plan.currency
    ) {
      throw new Error("existing government-fee order line does not match package pricing");
    }
  } else {
    const { data: insertedLine, error: insertLineError } = await admin
      .from("order_line")
      .insert({
        order_id: orderId,
        kind: "govt",
        amount_cents: plan.amountCents,
        currency: plan.currency,
        payee: plan.payee,
        description: plan.description,
      })
      .select("id, amount_cents, currency")
      .single();
    if (insertLineError || !insertedLine) {
      throw new Error(`allocation line insert: ${insertLineError?.message ?? "no row"}`);
    }
    orderLine = insertedLine;
  }

  const { error: insertError } = await admin.from("government_fee_allocations").insert({
    order_id: orderId,
    order_line_id: orderLine.id,
    application_id: order.application_id,
    amount_cents: plan.amountCents,
    currency: plan.currency,
    state: "reserved_pending_treasury",
    metadata_redacted: {
      funding_class: "viza_managed_card",
      official_fee_catalog_key: plan.catalogKey,
      created_by: "payment_provisioning",
    },
  });
  if (insertError && insertError.code !== "23505") throw new Error(`allocation insert: ${insertError.message}`);
}

async function processClaimedJob(admin: SupabaseClient, job: PaymentProvisioningJob): Promise<void> {
  const runner: ProvisioningStepRunner = {
    loadAccount: (orderId) => loadAccount(admin, orderId),
    ensureAccount: (orderId) => ensureAccountAndMagicLinkWithAdmin(admin, orderId),
    ensureAllocation: (orderId) => ensureGovernmentFeeAllocation(admin, orderId),
    ensureInbox: async (applicantId) => {
      await assignApplicantInboxAlias(applicantId);
    },
    enqueueRunner: async (account, orderId, provider) => {
      await enqueueRunnerJob(account.applicationId, account.country, {
        correlationId: `${provider}:${orderId}`,
      });
    },
    markStep: (patch) => updateJobStep(admin, job.id, patch),
  };

  try {
    await executePaymentProvisioningSteps(job, runner);
    const { error } = await admin.rpc("complete_payment_provisioning_job", { p_job_id: job.id });
    if (error) throw new Error(`payment provisioning complete: ${error.message}`);
  } catch (error) {
    const message = errorMessage(error);
    const { error: failError } = await admin.rpc("fail_payment_provisioning_job", {
      p_job_id: job.id,
      p_error: message,
      p_retry_delay_seconds: Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1)),
    });
    if (failError) throw new Error(`${message}; failed to persist retry state: ${failError.message}`);
  }
}

export async function runPaymentProvisioningWorker(
  admin: SupabaseClient,
  limit = 1,
): Promise<{ claimed: number; succeededOrRetried: number }> {
  const { data, error } = await admin.rpc("claim_payment_provisioning_jobs", {
    p_limit: limit,
    p_worker_id: workerId(),
    p_lease_seconds: 300,
  });
  if (error) throw new Error(`payment provisioning claim: ${error.message}`);

  const jobs = (data ?? []) as PaymentProvisioningJob[];
  for (const job of jobs) await processClaimedJob(admin, job);
  return { claimed: jobs.length, succeededOrRetried: jobs.length };
}

export { isPayableOrderStatus } from "@/lib/checkout/payment-state";
