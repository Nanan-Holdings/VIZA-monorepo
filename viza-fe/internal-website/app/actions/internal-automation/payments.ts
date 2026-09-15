"use server";

import {
  PAYMENT_REMOVED_CODE,
  PAYMENT_REMOVED_MESSAGE,
} from "../payment-removed";
import {
  actionFail,
  type AutomationActionResult,
  type InvoiceRequestSummary,
  type PaymentStateSummary,
  type RefundRequestSummary,
} from "./types";

const RETIRED_PAYMENT_ERROR = `${PAYMENT_REMOVED_CODE}: ${PAYMENT_REMOVED_MESSAGE}`;

/** Payment state reads are retired and never query payment tables. */
export async function getCustomerPaymentState(_input: {
  applicationId: string;
}): Promise<AutomationActionResult<PaymentStateSummary>> {
  return actionFail("UNKNOWN_ERROR", RETIRED_PAYMENT_ERROR);
}

/** Invoice requests are retired and never create invoice records. */
export async function requestCustomerInvoice(_input: {
  applicationId: string;
  paymentRecordId?: string;
  invoiceName?: string;
  taxIdentifier?: string;
  billingEmail?: string;
  notes?: string;
}): Promise<AutomationActionResult<InvoiceRequestSummary>> {
  return actionFail("UNKNOWN_ERROR", RETIRED_PAYMENT_ERROR);
}

/** Refund requests are retired and never create refund records. */
export async function requestCustomerRefund(_input: {
  applicationId: string;
  paymentRecordId?: string;
  amountCents?: number;
  reason?: string;
}): Promise<AutomationActionResult<RefundRequestSummary>> {
  return actionFail("UNKNOWN_ERROR", RETIRED_PAYMENT_ERROR);
}
