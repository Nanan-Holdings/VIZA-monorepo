"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPaidPaymentStatus,
  resolveBillingApplicant,
  type BillingPaymentRecord,
} from "./data";
import { getBillingCopy } from "./copy";

export interface InvoiceRequestState {
  status: "idle" | "success" | "error";
  message: string;
}

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function requestInvoice(
  _previousState: InvoiceRequestState,
  formData: FormData,
): Promise<InvoiceRequestState> {
  const applicant = await resolveBillingApplicant();
  const copy = getBillingCopy(readFormValue(formData, "locale"));
  if (!applicant) {
    return {
      status: "error",
      message: copy.actionErrors.signIn,
    };
  }

  const paymentRecordId = readFormValue(formData, "paymentRecordId");
  const invoiceName = readFormValue(formData, "invoiceName");
  const taxIdentifier = readFormValue(formData, "taxIdentifier");
  const billingEmail = readFormValue(formData, "billingEmail") || applicant.email || "";
  const notes = readFormValue(formData, "notes");

  if (!paymentRecordId) {
    return {
      status: "error",
      message: copy.actionErrors.choosePayment,
    };
  }

  if (!invoiceName) {
    return {
      status: "error",
      message: copy.actionErrors.invoiceName,
    };
  }

  if (!billingEmail || !isEmailLike(billingEmail)) {
    return {
      status: "error",
      message: copy.actionErrors.billingEmail,
    };
  }

  try {
    const adminClient = createAdminClient();
    const { data: paymentData, error: paymentError } = await adminClient
      .from("payment_records")
      .select("id, application_id, applicant_id, visa_package_id, amount_cents, currency, status, fee_type, receipt_url, created_at, updated_at")
      .eq("id", paymentRecordId)
      .eq("applicant_id", applicant.applicantId)
      .maybeSingle();

    const payment = paymentData as BillingPaymentRecord | null;
    if (paymentError || !payment || payment.fee_type !== "agency_fee") {
      return {
        status: "error",
        message: copy.actionErrors.paymentNotFound,
      };
    }

    if (!isPaidPaymentStatus(payment.status)) {
      return {
        status: "error",
        message: copy.actionErrors.paymentNotPaid,
      };
    }

    const { data: existingData } = await adminClient
      .from("invoice_requests")
      .select("id, status")
      .eq("payment_record_id", payment.id)
      .eq("applicant_id", applicant.applicantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existing = existingData as { id: string; status: string } | null;
    if (existing) {
      return {
        status: "success",
        message:
          existing.status === "generated"
            ? copy.actionErrors.alreadyGenerated
            : copy.actionErrors.alreadyRequested,
      };
    }

    const { error: insertError } = await adminClient.from("invoice_requests").insert({
      payment_record_id: payment.id,
      application_id: payment.application_id,
      applicant_id: applicant.applicantId,
      invoice_name: invoiceName,
      tax_identifier: taxIdentifier || null,
      billing_email: billingEmail,
      notes: notes || null,
      status: "requested",
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      return {
        status: "error",
        message: copy.actionErrors.submit,
      };
    }

    revalidatePath("/client/billing");
    return {
      status: "success",
      message: copy.actionErrors.received,
    };
  } catch {
    return {
      status: "error",
      message: copy.actionErrors.unavailable,
    };
  }
}
