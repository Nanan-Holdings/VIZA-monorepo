"use server";

import { Buffer } from "node:buffer";
import { createClient } from "@/lib/supabase/server";
import { withAdmin } from "@/lib/auth/with-admin";
import {
  buildReceiptPdf,
  buildInvoicePdf,
  type PdfOrder,
  type PdfOrderLine,
  type InvoiceMeta,
} from "@/lib/pdf/receipt";
import { sendEmail } from "@/lib/email/resend";

/**
 * Receipts + invoicing (PAY-005).
 *
 * `getOrderReceiptPdf(orderId, mode, invoice?)` returns a PDF buffer
 * for the order. Caller must own the order (RLS-guarded read).
 *
 * `mailReceiptOnPaid(orderId)` is invoked from the Stripe webhook
 * once an order flips to `paid`. It builds the receipt and POSTs it
 * to Resend addressed to the applicant.
 */

interface OrderRow {
  id: string;
  application_id: string;
  applicant_id: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
}

interface OrderLineRow {
  kind: string;
  amount_cents: number;
  currency: string;
  payee: string;
  description: string | null;
}

interface ApplicationRow {
  country: string;
  visa_type: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  auth_user_id: string | null;
}

async function loadOrderForCaller(
  orderId: string,
  authUserId: string | null,
): Promise<{
  order: OrderRow;
  lines: OrderLineRow[];
  app: ApplicationRow;
  profile: ProfileRow;
}> {
  return withAdmin("system", "actions/receipts:load", async (admin) => {
    const { data: order, error: orderErr } = await admin
      .from("order")
      .select(
        "id, application_id, applicant_id, agency_fee_cents, govt_fee_cents, currency, status, paid_at, stripe_payment_intent_id",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) throw new Error("Order not found");

    const { data: profile } = await admin
      .from("applicant_profiles")
      .select("id, full_name, email, auth_user_id")
      .eq("id", order.applicant_id)
      .single();
    if (!profile) throw new Error("Applicant profile not found");
    if (authUserId !== null && profile.auth_user_id !== authUserId) {
      throw new Error("Unauthorized");
    }

    const [{ data: lines }, { data: app }] = await Promise.all([
      admin
        .from("order_line")
        .select("kind, amount_cents, currency, payee, description")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      admin
        .from("applications")
        .select("country, visa_type")
        .eq("id", order.application_id)
        .single(),
    ]);
    if (!app) throw new Error("Application not found");

    return {
      order: order as OrderRow,
      lines: (lines ?? []) as OrderLineRow[],
      app: app as ApplicationRow,
      profile: profile as ProfileRow,
    };
  });
}

function toPdfOrder(
  order: OrderRow,
  lines: OrderLineRow[],
  app: ApplicationRow,
  profile: ProfileRow,
): PdfOrder {
  const pdfLines: PdfOrderLine[] = lines.map((l) => ({
    kind: l.kind,
    description: l.description ?? l.payee,
    amountCents: l.amount_cents,
    currency: l.currency,
  }));
  return {
    id: order.id,
    applicationId: order.application_id,
    applicantName: profile.full_name ?? "VIZA applicant",
    applicantEmail: profile.email ?? "",
    paidAt: order.paid_at,
    status: order.status,
    currency: order.currency,
    agencyFeeCents: order.agency_fee_cents,
    govtFeeCents: order.govt_fee_cents,
    lines: pdfLines,
    packageLabel: `${app.country}/${app.visa_type}`,
    stripePaymentIntentId: order.stripe_payment_intent_id,
  };
}

export type ReceiptMode = "receipt" | "invoice";

export async function getOrderReceiptPdf(
  orderId: string,
  mode: ReceiptMode,
  invoice?: InvoiceMeta,
): Promise<{ pdf: Buffer; filename: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { order, lines, app, profile } = await loadOrderForCaller(
    orderId,
    user.id,
  );
  const pdfOrder = toPdfOrder(order, lines, app, profile);
  const buf =
    mode === "invoice" && invoice
      ? buildInvoicePdf(pdfOrder, invoice)
      : buildReceiptPdf(pdfOrder);
  const filename = `viza-${mode}-${order.id}.pdf`;
  return { pdf: buf, filename };
}

/** Stripe-webhook side-effect: email the receipt PDF to the applicant. */
export async function mailReceiptOnPaid(orderId: string): Promise<void> {
  const { order, lines, app, profile } = await loadOrderForCaller(
    orderId,
    null,
  );
  if (!profile.email) {
    console.warn(
      `[receipts] applicant ${profile.id} has no email — skipping receipt mail`,
    );
    return;
  }
  const pdfOrder = toPdfOrder(order, lines, app, profile);
  const pdf = buildReceiptPdf(pdfOrder);
  await sendEmail({
    from: "VIZA <receipts@haggstorm.com>",
    to: profile.email,
    subject: `Your VIZA receipt — order ${order.id}`,
    text:
      `Hi ${profile.full_name ?? "there"},\n\nThanks for your VIZA order. ` +
      `Your receipt is attached.\n\nOrder: ${order.id}\nApplication: ${order.application_id}\n\n— VIZA`,
    attachments: [
      {
        filename: `viza-receipt-${order.id}.pdf`,
        content: pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
}
