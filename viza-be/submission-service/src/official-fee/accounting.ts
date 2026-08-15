import { supabase } from "../supabase.js";
import type { ManagedOfficialFeeExecutionContext } from "./execution-context.js";

async function nextAttemptNumber(intentId: string): Promise<number> {
  const { data, error } = await supabase
    .from("official_fee_payment_attempts")
    .select("attempt_number")
    .eq("official_fee_payment_intent_id", intentId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Could not load official-fee attempts: ${error.message}`);
  const current = Number((data?.[0] as { attempt_number?: number | string } | undefined)?.attempt_number ?? 0);
  return Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1;
}

function amountMajor(context: ManagedOfficialFeeExecutionContext): number {
  return Number(context.allocation.amount_cents) / 100;
}

export async function persistOfficialFeeFundingState(
  applicationId: string,
  state:
    | "official_fee_funding_required"
    | "official_fee_payment_pending"
    | "official_fee_payment_manual_review",
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({ official_fee_status: state, updated_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) throw new Error(`Could not persist UK official-fee funding state: ${error.message}`);
}

export async function recordOfficialFeeReview(input: {
  context: ManagedOfficialFeeExecutionContext;
  errorCode: string;
  message: string;
}): Promise<string> {
  const now = new Date().toISOString();
  const attemptNumber = await nextAttemptNumber(input.context.officialFeePaymentIntentId);
  const { data: attempt, error: attemptError } = await supabase
    .from("official_fee_payment_attempts")
    .insert({
      official_fee_payment_intent_id: input.context.officialFeePaymentIntentId,
      application_id: input.context.applicationId,
      attempt_number: attemptNumber,
      provider: input.context.intent.provider ?? "ukvi_standard_visitor_official_fee",
      mode: input.context.intent.mode ?? "live_assisted",
      status: "manual_review",
      request_payload_redacted_json: {
        allocation_id: input.context.allocationId,
        amount: amountMajor(input.context),
        currency: input.context.allocation.currency.toUpperCase(),
      },
      response_payload_redacted_json: { outcome: "review_required" },
      error_code: input.errorCode,
      error_message: input.message.slice(0, 2_000),
      started_at: now,
      finished_at: now,
    })
    .select("id")
    .single();
  if (attemptError || !attempt) {
    throw new Error(`Could not record UK official-fee review attempt: ${attemptError?.message ?? "empty response"}`);
  }

  const [intentUpdate, allocationUpdate, applicationUpdate] = await Promise.all([
    supabase
      .from("official_fee_payment_intents")
      .update({ status: "manual_review", updated_at: now })
      .eq("id", input.context.officialFeePaymentIntentId),
    supabase
      .from("government_fee_allocations")
      .update({ state: "review_required", updated_at: now })
      .eq("id", input.context.allocationId),
    supabase
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_manual_review",
        official_fee_payment_intent_id: input.context.officialFeePaymentIntentId,
        updated_at: now,
      })
      .eq("id", input.context.applicationId),
  ]);
  if (intentUpdate.error) throw new Error(`Could not mark official-fee intent for review: ${intentUpdate.error.message}`);
  if (allocationUpdate.error) throw new Error(`Could not quarantine official-fee allocation: ${allocationUpdate.error.message}`);
  if (applicationUpdate.error) throw new Error(`Could not mark application official fee for review: ${applicationUpdate.error.message}`);
  return (attempt as { id: string }).id;
}

export async function recordOfficialFeePaid(input: {
  context: ManagedOfficialFeeExecutionContext;
  receiptNumber: string;
  applicationReference?: string;
}): Promise<{ attemptId: string; receiptId: string }> {
  const now = new Date().toISOString();
  const amount = amountMajor(input.context);
  const currency = input.context.allocation.currency.toUpperCase();
  const attemptNumber = await nextAttemptNumber(input.context.officialFeePaymentIntentId);
  const { data: attempt, error: attemptError } = await supabase
    .from("official_fee_payment_attempts")
    .insert({
      official_fee_payment_intent_id: input.context.officialFeePaymentIntentId,
      application_id: input.context.applicationId,
      attempt_number: attemptNumber,
      provider: input.context.intent.provider ?? "ukvi_standard_visitor_official_fee",
      mode: input.context.intent.mode ?? "live_assisted",
      status: "succeeded",
      request_payload_redacted_json: {
        allocation_id: input.context.allocationId,
        amount,
        currency,
      },
      response_payload_redacted_json: { outcome: "paid" },
      official_receipt_number: input.receiptNumber,
      started_at: now,
      finished_at: now,
    })
    .select("id")
    .single();
  if (attemptError || !attempt) {
    throw new Error(`Could not record UK official-fee attempt: ${attemptError?.message ?? "empty response"}`);
  }

  const { data: receipt, error: receiptError } = await supabase
    .from("official_fee_receipts")
    .insert({
      application_id: input.context.applicationId,
      user_id: input.context.intent.user_id,
      official_fee_payment_intent_id: input.context.officialFeePaymentIntentId,
      country_code: "GB",
      receipt_number: input.receiptNumber,
      receipt_url: null,
      receipt_file_url: null,
      amount,
      currency,
      paid_at: now,
      source: "ukvi_official_payment_page",
      raw_receipt_redacted_json: {
        allocation_id: input.context.allocationId,
        application_reference_present: Boolean(input.applicationReference),
        amount,
        currency,
      },
      created_at: now,
    })
    .select("id")
    .single();
  if (receiptError || !receipt) {
    throw new Error(`Could not record UK official-fee receipt: ${receiptError?.message ?? "empty response"}`);
  }

  const receiptId = (receipt as { id: string }).id;
  const [intentUpdate, applicationUpdate] = await Promise.all([
    supabase
      .from("official_fee_payment_intents")
      .update({ status: "succeeded", updated_at: now })
      .eq("id", input.context.officialFeePaymentIntentId),
    supabase
      .from("applications")
      .update({
        official_fee_status: "official_fee_payment_succeeded",
        official_fee_payment_intent_id: input.context.officialFeePaymentIntentId,
        official_fee_receipt_id: receiptId,
        external_status: "submitted_to_official_portal",
        external_reference: input.applicationReference ?? input.receiptNumber,
        external_status_updated_at: now,
        updated_at: now,
      })
      .eq("id", input.context.applicationId),
  ]);
  if (intentUpdate.error) throw new Error(`Could not mark official-fee intent paid: ${intentUpdate.error.message}`);
  if (applicationUpdate.error) throw new Error(`Could not mark application official fee paid: ${applicationUpdate.error.message}`);

  return { attemptId: (attempt as { id: string }).id, receiptId };
}
