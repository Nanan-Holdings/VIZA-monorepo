"use server";

import { revalidatePath } from "next/cache";
import {
  getCustomerAutomationContext,
  getOwnedApplication,
  insertApplicationEvent,
  type InvoiceRequestRow,
  type PaymentRecordRow,
  type RefundRecordRow,
} from "./db";
import {
  buildPaymentStateSummary,
  readApplicationAutomationBundles,
  summarizeInvoiceRequest,
  summarizeRefundRequest,
} from "./read-model";
import {
  actionErrorMessage,
  actionFail,
  actionOk,
  type AutomationActionResult,
  type InvoiceRequestSummary,
  type PaymentStateSummary,
  type RefundRequestSummary,
} from "./types";

const OPEN_REQUEST_STATUSES = ["requested", "pending", "processing", "approved", "queued"];
const PAID_PAYMENT_STATUSES = ["paid", "succeeded", "success", "complete", "completed"];

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function findPaymentRecord(
  records: PaymentRecordRow[],
  paymentRecordId?: string,
): PaymentRecordRow | null {
  if (paymentRecordId) {
    return records.find((record) => record.id === paymentRecordId) ?? null;
  }

  return (
    records.find((record) => PAID_PAYMENT_STATUSES.includes(record.status)) ??
    records[0] ??
    null
  );
}

export async function getCustomerPaymentState(input: {
  applicationId: string;
}): Promise<AutomationActionResult<PaymentStateSummary>> {
  try {
    if (!input.applicationId) {
      return actionFail("VALIDATION_ERROR", "applicationId is required.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    const bundlesResult = await readApplicationAutomationBundles(
      contextResult.data.adminClient,
      [applicationResult.data],
    );
    if (!bundlesResult.ok) return bundlesResult;

    const bundle = bundlesResult.data[0];
    if (!bundle) {
      return actionFail("NOT_FOUND", "Automation state was not found.");
    }

    return actionOk(
      buildPaymentStateSummary(
        bundle.application,
        bundle.paymentRecords,
        bundle.invoiceRequests,
        bundle.refundRecords,
      ),
    );
  } catch (error) {
    console.error(
      "[getCustomerPaymentState]",
      actionErrorMessage(error, "Unexpected payment state error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not load payment state.");
  }
}

export async function requestCustomerInvoice(input: {
  applicationId: string;
  paymentRecordId?: string;
  invoiceName?: string;
  taxIdentifier?: string;
  billingEmail?: string;
  notes?: string;
}): Promise<AutomationActionResult<InvoiceRequestSummary>> {
  try {
    if (!input.applicationId) {
      return actionFail("VALIDATION_ERROR", "applicationId is required.");
    }

    const billingEmail = input.billingEmail?.trim() || undefined;
    if (billingEmail && !isLikelyEmail(billingEmail)) {
      return actionFail("VALIDATION_ERROR", "Billing email is invalid.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    const bundlesResult = await readApplicationAutomationBundles(
      contextResult.data.adminClient,
      [applicationResult.data],
    );
    if (!bundlesResult.ok) return bundlesResult;

    const bundle = bundlesResult.data[0];
    const paymentRecord = bundle
      ? findPaymentRecord(bundle.paymentRecords, input.paymentRecordId)
      : null;

    if (!bundle || !paymentRecord) {
      return actionFail("NOT_FOUND", "No payment record is available for invoice request.");
    }

    const existing = bundle.invoiceRequests.find(
      (request) =>
        request.payment_record_id === paymentRecord.id &&
        OPEN_REQUEST_STATUSES.includes(request.status),
    );

    if (existing) {
      return actionOk(summarizeInvoiceRequest(existing));
    }

    const { data, error } = await contextResult.data.adminClient
      .from<InvoiceRequestRow>("invoice_requests")
      .insert({
        payment_record_id: paymentRecord.id,
        application_id: applicationResult.data.id,
        applicant_id: contextResult.data.applicantId,
        invoice_name: input.invoiceName?.trim() || null,
        tax_identifier: input.taxIdentifier?.trim() || null,
        billing_email: billingEmail ?? contextResult.data.email,
        notes: input.notes?.trim() || null,
        status: "requested",
      })
      .select(
        "id, payment_record_id, application_id, applicant_id, invoice_name, tax_identifier, billing_email, status, notes, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      return actionFail("DB_ERROR", "Could not create invoice request.");
    }

    await insertApplicationEvent(contextResult.data.adminClient, {
      applicationId: applicationResult.data.id,
      applicantId: contextResult.data.applicantId,
      eventType: "invoice_requested",
      actorType: "customer",
      actorId: contextResult.data.userId,
      message: "Customer requested an invoice.",
      metadata: {
        payment_record_id: paymentRecord.id,
        invoice_request_id: data.id,
      },
    });

    revalidatePath("/client/billing");
    revalidatePath("/admin/billing");

    return actionOk(summarizeInvoiceRequest(data));
  } catch (error) {
    console.error(
      "[requestCustomerInvoice]",
      actionErrorMessage(error, "Unexpected invoice request error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not request invoice.");
  }
}

export async function requestCustomerRefund(input: {
  applicationId: string;
  paymentRecordId?: string;
  amountCents?: number;
  reason?: string;
}): Promise<AutomationActionResult<RefundRequestSummary>> {
  try {
    if (!input.applicationId) {
      return actionFail("VALIDATION_ERROR", "applicationId is required.");
    }

    const contextResult = await getCustomerAutomationContext();
    if (!contextResult.ok) return contextResult;

    const applicationResult = await getOwnedApplication(
      contextResult.data.adminClient,
      contextResult.data.applicantId,
      input.applicationId,
    );
    if (!applicationResult.ok) return applicationResult;

    const bundlesResult = await readApplicationAutomationBundles(
      contextResult.data.adminClient,
      [applicationResult.data],
    );
    if (!bundlesResult.ok) return bundlesResult;

    const bundle = bundlesResult.data[0];
    const paymentRecord = bundle
      ? findPaymentRecord(bundle.paymentRecords, input.paymentRecordId)
      : null;

    if (!bundle || !paymentRecord) {
      return actionFail("NOT_FOUND", "No payment record is available for refund request.");
    }

    const paymentState = buildPaymentStateSummary(
      bundle.application,
      bundle.paymentRecords,
      bundle.invoiceRequests,
      bundle.refundRecords,
    );
    const amountCents = input.amountCents ?? paymentState.refundEligibility.maxAmountCents;

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return actionFail("VALIDATION_ERROR", "Refund amount must be greater than zero.");
    }

    if (amountCents > paymentState.refundEligibility.maxAmountCents) {
      return actionFail("VALIDATION_ERROR", "Refund amount exceeds the paid balance.");
    }

    const existing = bundle.refundRecords.find(
      (request) =>
        request.payment_record_id === paymentRecord.id &&
        OPEN_REQUEST_STATUSES.includes(request.status),
    );

    if (existing) {
      return actionOk(summarizeRefundRequest(existing));
    }

    const { data, error } = await contextResult.data.adminClient
      .from<RefundRecordRow>("refund_records")
      .insert({
        payment_record_id: paymentRecord.id,
        application_id: applicationResult.data.id,
        applicant_id: contextResult.data.applicantId,
        amount_cents: amountCents,
        currency: paymentRecord.currency,
        status: "requested",
        reason: input.reason?.trim() || null,
        policy_snapshot: {
          evaluated_at: new Date().toISOString(),
          max_amount_cents: paymentState.refundEligibility.maxAmountCents,
          reason: paymentState.refundEligibility.reason,
          source: "customer_refund_request_action",
        },
      })
      .select(
        "id, payment_record_id, application_id, applicant_id, amount_cents, currency, status, reason, policy_snapshot, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      return actionFail("DB_ERROR", "Could not create refund request.");
    }

    await insertApplicationEvent(contextResult.data.adminClient, {
      applicationId: applicationResult.data.id,
      applicantId: contextResult.data.applicantId,
      eventType: "refund_requested",
      actorType: "customer",
      actorId: contextResult.data.userId,
      message: "Customer requested a refund review.",
      metadata: {
        payment_record_id: paymentRecord.id,
        refund_record_id: data.id,
        amount_cents: amountCents,
        currency: paymentRecord.currency,
      },
    });

    revalidatePath("/client/billing");
    revalidatePath("/admin/billing");

    return actionOk(summarizeRefundRequest(data));
  } catch (error) {
    console.error(
      "[requestCustomerRefund]",
      actionErrorMessage(error, "Unexpected refund request error"),
    );
    return actionFail("UNKNOWN_ERROR", "Could not request refund.");
  }
}
