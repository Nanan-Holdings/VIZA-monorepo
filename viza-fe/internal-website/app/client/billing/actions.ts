"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isPaidPaymentStatus,
  resolveBillingApplicant,
  type BillingPaymentRecord,
} from "./data";

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
  if (!applicant) {
    return {
      status: "error",
      message: "Please sign in again before requesting an invoice.",
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
      message: "Choose a paid agency-fee record before requesting an invoice.",
    };
  }

  if (!invoiceName) {
    return {
      status: "error",
      message: "Enter the legal name that should appear on the invoice.",
    };
  }

  if (!billingEmail || !isEmailLike(billingEmail)) {
    return {
      status: "error",
      message: "Enter a valid billing email address.",
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
        message: "We could not find a matching agency-fee payment for this account.",
      };
    }

    if (!isPaidPaymentStatus(payment.status)) {
      return {
        status: "error",
        message: "Invoices can be requested after the agency-fee payment is marked paid.",
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
            ? "An invoice has already been generated for this payment."
            : "Your invoice request is already with the VIZA team.",
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
        message: "We could not submit the invoice request. Please try again later.",
      };
    }

    revalidatePath("/client/billing");
    return {
      status: "success",
      message: "Invoice request received. The VIZA team will generate it after review.",
    };
  } catch {
    return {
      status: "error",
      message: "Invoice requests are temporarily unavailable.",
    };
  }
}
